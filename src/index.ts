import express, { type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { RedditClient, type RedditPost } from "./reddit.js";
import { DEFAULT_KEYWORDS, DEFAULT_SUBREDDITS } from "./config.js";
import { PekinDb } from "./pekin.js";

const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  MCP_PATH_TOKEN,
  PEKIN_DATABASE_URL,
  PORT = "3000",
} = process.env;

const pekin = PEKIN_DATABASE_URL ? new PekinDb(PEKIN_DATABASE_URL) : null;

if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME) {
  console.error("Missing REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET or REDDIT_USERNAME");
  process.exit(1);
}
if (!MCP_PATH_TOKEN || MCP_PATH_TOKEN.length < 24) {
  console.error("MCP_PATH_TOKEN must be set to a random string of 24+ characters");
  process.exit(1);
}

const reddit = new RedditClient(
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  `server:pekin-reddit-scout:1.0 (by /u/${REDDIT_USERNAME})`,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function asError(err: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
  };
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "reddit-scout", version: "1.0.0" });

  server.registerTool(
    "search_posts",
    {
      description:
        "Search Reddit posts by keyword. Optionally restrict to subreddits. Defaults to newest posts from the past week. NSFW, removed and stickied posts are filtered out.",
      inputSchema: {
        query: z.string().describe("Search terms, e.g. 'meal prep for beginners'"),
        subreddits: z.array(z.string()).optional().describe("Subreddit names without r/"),
        sort: z.enum(["new", "relevance", "top", "hot", "comments"]).optional(),
        time: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        return asText(await reddit.search(args));
      } catch (e) {
        return asError(e);
      }
    },
  );

  server.registerTool(
    "scout_feed",
    {
      description:
        "Run the Pekin the Chef keyword watchlist across food subreddits and return de-duplicated recent posts, each tagged with the keywords it matched. Use this for 'pull recent Reddit posts' requests.",
      inputSchema: {
        keywords: z.array(z.string()).optional().describe("Override the default keyword list"),
        subreddits: z
          .array(z.string())
          .optional()
          .describe("Override the default subreddits. Pass [] to search all of Reddit."),
        time: z.enum(["day", "week", "month"]).optional().describe("Window, default 'week'"),
        min_score: z.number().int().optional().describe("Drop posts below this score, default 0"),
        max_results: z.number().int().min(1).max(200).optional().describe("Default 60"),
      },
    },
    async ({ keywords, subreddits, time = "week", min_score = 0, max_results = 60 }) => {
      try {
        const kws = keywords?.length ? keywords : DEFAULT_KEYWORDS;
        const subs = subreddits ?? DEFAULT_SUBREDDITS;
        const found = new Map<string, RedditPost & { matched_keywords: string[] }>();
        const errors: string[] = [];
        for (const kw of kws) {
          try {
            const posts = await reddit.search({ query: kw, subreddits: subs, sort: "new", time, limit: 25 });
            for (const p of posts) {
              const existing = found.get(p.id);
              if (existing) existing.matched_keywords.push(kw);
              else found.set(p.id, { ...p, matched_keywords: [kw] });
            }
          } catch (e) {
            errors.push(`${kw}: ${e instanceof Error ? e.message : e}`);
            if (String(e).includes("rate limit")) break;
          }
          await sleep(700); // stay well under Reddit's 100 req/min app limit
        }
        const results = [...found.values()]
          .filter((p) => p.score >= min_score)
          .sort((a, b) => b.matched_keywords.length - a.matched_keywords.length || a.age_hours - b.age_hours)
          .slice(0, max_results);
        return asText({
          searched_keywords: kws.length,
          subreddits: subs.length ? subs : "all",
          window: time,
          total_unique: found.size,
          returned: results.length,
          errors,
          posts: results,
        });
      } catch (e) {
        return asError(e);
      }
    },
  );

  server.registerTool(
    "list_new",
    {
      description: "Newest posts in one or more subreddits, regardless of keyword.",
      inputSchema: {
        subreddits: z.array(z.string()).min(1),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ subreddits, limit }) => {
      try {
        return asText(await reddit.listNew(subreddits, limit));
      } catch (e) {
        return asError(e);
      }
    },
  );

  server.registerTool(
    "get_post",
    {
      description:
        "Fetch one post's full text and top comments. Accepts a post ID or a full Reddit URL. Use before drafting a reply so the reply fits the thread.",
      inputSchema: {
        id_or_url: z.string(),
        comment_limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ id_or_url, comment_limit }) => {
      try {
        return asText(await reddit.getPost(id_or_url, comment_limit));
      } catch (e) {
        return asError(e);
      }
    },
  );

  server.registerTool(
    "subreddit_rules",
    {
      description:
        "A subreddit's posted rules. Check before suggesting any comment that mentions Pekin the Chef, since many food subs restrict self-promotion.",
      inputSchema: { subreddit: z.string() },
    },
    async ({ subreddit }) => {
      try {
        return asText(await reddit.getRules(subreddit));
      } catch (e) {
        return asError(e);
      }
    },
  );

  if (pekin) {
    server.registerTool(
      "pekin_lookup",
      {
        description:
          "Check whether Pekin the Chef has a restaurant and/or dish. Use before answering a copycat request for a named restaurant: if the restaurant isn't on Pekin, skip the post. Matching ignores case, spaces and punctuation.",
        inputSchema: {
          restaurant: z.string().optional().describe("Restaurant name, e.g. 'The Public Kitchen & Bar'"),
          dish: z.string().optional().describe("Dish name or keyword, e.g. 'shrimp grits'"),
          city: z.string().optional().describe("Narrow by city, e.g. 'Savannah'"),
          limit: z.number().int().min(1).max(25).optional(),
        },
      },
      async (args) => {
        if (!args.restaurant && !args.dish) return asError("Give a restaurant, a dish, or both.");
        try {
          return asText(await pekin.lookup(args));
        } catch (e) {
          return asError(e);
        }
      },
    );

    server.registerTool(
      "pekin_recipe",
      {
        description:
          "Full Pekin recipe (ingredients and directions) by recipe id or pekinthechef.com URL. Use to base a Reddit reply on Pekin's version of a dish.",
        inputSchema: { id_or_url: z.string() },
      },
      async ({ id_or_url }) => {
        try {
          return asText(await pekin.recipe(id_or_url));
        } catch (e) {
          return asError(e);
        }
      },
    );
  }

  return server;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

const expected = Buffer.from(MCP_PATH_TOKEN);
function tokenOk(token: string | string[] | undefined): boolean {
  if (typeof token !== "string") return false;
  const got = Buffer.from(token);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "reddit-scout" });
});

// Stateless Streamable HTTP: a fresh server + transport per request.
app.post("/mcp/:token", async (req: Request, res: Response) => {
  if (!tokenOk(req.params.token)) {
    res.status(404).end();
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  }
});

app.all("/mcp/:token", (req, res) => {
  res.status(tokenOk(req.params.token) ? 405 : 404).end();
});

app.listen(Number(PORT), () => {
  console.log(`reddit-scout MCP listening on :${PORT}`);
});
