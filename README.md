# reddit-scout

A small, read-only Reddit MCP server for Pekin the Chef. Deploy it once, add it to Claude as a custom connector, and you can say "pull recent Reddit posts" in any chat. The bundled `reddit-scout` skill tells Claude how to triage the results and draft replies.

Claude can't reach Reddit directly, so this server does the fetching with your own Reddit app's credentials and hands Claude the results.

## Tools

| Tool | What it does |
|---|---|
| `scout_feed` | Runs the keyword watchlist in `src/config.ts` across food subreddits, de-duplicates, tags each post with the keywords it matched |
| `search_posts` | One keyword search, optionally limited to subreddits, sort and time window |
| `list_new` | Newest posts in given subreddits |
| `get_post` | Full post text + top comments (ID or URL) |
| `subreddit_rules` | A subreddit's rules, to check self-promotion policy |
| `pekin_lookup` | Is this restaurant / dish on Pekin? Searches the Typesense mirror (needs the `TYPESENSE_*` variables) |
| `pekin_recipe` | Full Pekin recipe from a pekinthechef.com URL, via the public Pekin API (no setup) |

All read-only. NSFW, removed and stickied posts are filtered out. Nothing here can post or comment.

## Setup

### 1. Reddit app

Use your existing app at <https://www.reddit.com/prefs/apps>. "Web app" or "script" both work: the server uses application-only OAuth (`client_credentials`), so no login or redirect is involved. You need the client ID (under the app name) and the secret.

### 2. Deploy to Railway

1. New project → Deploy from GitHub repo → this repo. `railway.json` sets the build and start commands.
2. Add variables (Service → Variables):

   | Variable | Value |
   |---|---|
   | `REDDIT_CLIENT_ID` | your app's client ID |
   | `REDDIT_CLIENT_SECRET` | your app's secret |
   | `REDDIT_USERNAME` | your Reddit username (goes in the User-Agent Reddit requires) |
   | `MCP_PATH_TOKEN` | a random string, e.g. `openssl rand -hex 24` |

3. For `pekin_lookup`, add the Typesense variables (copy the values from the **Web** service in the Pekin project, which already uses a browser-safe search key):

   | Variable | Value |
   |---|---|
   | `TYPESENSE_URL` | `https://typesense-production-9e9a.up.railway.app` |
   | `TYPESENSE_SEARCH_KEY` | Web's `NEXT_PUBLIC_TYPESENSE_API_KEY` (must be a search-only key) |
   | `TYPESENSE_COLLECTION` | Web's `NEXT_PUBLIC_TYPESENSE_RECIPE_COLLECTION_NAME` |

   `pekin_recipe` works without any variables (it calls `https://api.pekinthechef.com/recipes/{restaurant}/{dish}`, the same endpoint the site uses). Optional: `PEKIN_DATABASE_URL` (read-only role, see below) adds a Postgres fallback for lookups and lets `pekin_recipe` take numeric ids.
4. Settings → Networking → Generate domain. Visiting `https://<domain>/` should return `{"ok":true}`.

Any Node 20+ host works the same way (Render, Fly, a VPS): `npm ci && npm run build && npm start`.

#### Optional: read-only database role

The Pekin DB lives in a different Railway project, so use its public connection string (Postgres service → Variables → `DATABASE_PUBLIC_URL`) with a dedicated role instead of the admin user. Run once against the Pekin DB:

```sql
CREATE ROLE reddit_scout_ro LOGIN PASSWORD '<generate one>';
GRANT CONNECT ON DATABASE railway TO reddit_scout_ro;
GRANT USAGE ON SCHEMA public TO reddit_scout_ro;
GRANT SELECT ON public.users, public.recipes TO reddit_scout_ro;
```

Then set `PEKIN_DATABASE_URL=postgresql://reddit_scout_ro:<password>@<public host>:<port>/railway` on the reddit-scout service.

### 3. Add the connector in Claude

Settings → Connectors → Add custom connector:

- Name: `reddit-scout`
- URL: `https://<your-domain>/mcp/<MCP_PATH_TOKEN>`

The token in the path is what keeps the endpoint private; anyone without it gets a 404. Treat the full URL like a password, and rotate the token in Railway if it leaks.

### 4. Add the skill

Upload `skill/reddit-scout/` as a skill (Settings → Capabilities → Skills, or zip the folder). Then enable the connector in a chat and ask "pull recent Reddit posts".

## Changing what it watches

Edit `DEFAULT_KEYWORDS` and `DEFAULT_SUBREDDITS` in `src/config.ts` and push; Railway redeploys. You can also override both per call ("search all of Reddit for 'cooking rut'").

## Limits

- Reddit allows about 100 requests/minute for an OAuth app. `scout_feed` makes one request per keyword with a 0.7 s gap, so the default list (~35 keywords) takes about 30 seconds.
- Reddit search returns at most ~25 newest matches per keyword per call here; narrow keywords beat broad ones.

## Local dev

```
cp .env.example .env   # fill in
npm install
set -a && . ./.env && set +a && npm run dev
```
