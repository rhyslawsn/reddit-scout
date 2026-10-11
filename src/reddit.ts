// Minimal Reddit API client using application-only OAuth (client_credentials).
// Works with "web app" and "script" type Reddit apps. Read-only.

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  created_iso: string;
  age_hours: number;
  url: string;
  selftext_snippet: string;
  flair: string | null;
  is_self: boolean;
}

interface RawPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  selftext?: string;
  link_flair_text?: string | null;
  is_self: boolean;
  over_18: boolean;
  removed_by_category?: string | null;
  stickied?: boolean;
}

export class RedditClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private userAgent: string,
  ) {}

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      throw new Error(`Reddit token request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.token;
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const qs = new URLSearchParams(
      Object.entries({ raw_json: 1, ...params }).map(([k, v]) => [k, String(v)]),
    );
    const url = `https://oauth.reddit.com${path}?${qs}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${await this.getToken()}`, "User-Agent": this.userAgent },
      });
      if (res.status === 401 && attempt === 0) {
        this.token = null; // expired early; refresh once
        continue;
      }
      if (res.status === 429) {
        const wait = Number(res.headers.get("x-ratelimit-reset") ?? 5);
        throw new Error(`Reddit rate limit hit; retry in ~${wait}s`);
      }
      if (!res.ok) throw new Error(`Reddit GET ${path} failed: ${res.status}`);
      return (await res.json()) as T;
    }
    throw new Error(`Reddit GET ${path} failed after token refresh`);
  }

  static normalize(p: RawPost): RedditPost | null {
    if (p.over_18 || p.removed_by_category || p.stickied) return null;
    if (p.author === "[deleted]") return null;
    const created = p.created_utc * 1000;
    const text = (p.selftext ?? "").replace(/\s+/g, " ").trim();
    return {
      id: p.id,
      title: p.title,
      subreddit: p.subreddit,
      author: p.author,
      score: p.score,
      num_comments: p.num_comments,
      created_iso: new Date(created).toISOString(),
      age_hours: Math.round(((Date.now() - created) / 3_600_000) * 10) / 10,
      url: `https://reddit.com${p.permalink}`,
      selftext_snippet: text.length > 400 ? `${text.slice(0, 400)}…` : text,
      flair: p.link_flair_text ?? null,
      is_self: p.is_self,
    };
  }

  /** Search posts. If subreddits are given, search is restricted to them. */
  async search(opts: {
    query: string;
    subreddits?: string[];
    sort?: "new" | "relevance" | "top" | "hot" | "comments";
    time?: "hour" | "day" | "week" | "month" | "year" | "all";
    limit?: number;
  }): Promise<RedditPost[]> {
    const subs = (opts.subreddits ?? []).map((s) => s.replace(/^r\//i, "")).filter(Boolean);
    const path = subs.length ? `/r/${subs.join("+")}/search` : "/search";
    const data = await this.get<{ data: { children: { data: RawPost }[] } }>(path, {
      q: opts.query,
      sort: opts.sort ?? "new",
      t: opts.time ?? "week",
      limit: Math.min(opts.limit ?? 25, 100),
      type: "link",
      ...(subs.length ? { restrict_sr: 1 } : {}),
    });
    return data.data.children
      .map((c) => RedditClient.normalize(c.data))
      .filter((p): p is RedditPost => p !== null);
  }

  /** Newest posts in one or more subreddits. */
  async listNew(subreddits: string[], limit = 25): Promise<RedditPost[]> {
    const subs = subreddits.map((s) => s.replace(/^r\//i, "")).join("+");
    const data = await this.get<{ data: { children: { data: RawPost }[] } }>(`/r/${subs}/new`, {
      limit: Math.min(limit, 100),
    });
    return data.data.children
      .map((c) => RedditClient.normalize(c.data))
      .filter((p): p is RedditPost => p !== null);
  }

  /** A post with its top-level comments. */
  async getPost(id: string, commentLimit = 15) {
    const cleanId = id.replace(/^t3_/, "").match(/comments\/([a-z0-9]+)/i)?.[1] ?? id.replace(/^t3_/, "");
    const data = await this.get<[{ data: { children: { data: RawPost }[] } }, { data: { children: { kind: string; data: { author: string; body: string; score: number } }[] } }]>(
      `/comments/${cleanId}`,
      { limit: commentLimit, depth: 1, sort: "top" },
    );
    const raw = data[0].data.children[0]?.data;
    if (!raw) throw new Error(`Post ${cleanId} not found`);
    const post = RedditClient.normalize({ ...raw, over_18: false, stickied: false }) ?? raw;
    const comments = data[1].data.children
      .filter((c) => c.kind === "t1")
      .map((c) => ({
        author: c.data.author,
        score: c.data.score,
        body: c.data.body.length > 500 ? `${c.data.body.slice(0, 500)}…` : c.data.body,
      }));
    return { post, full_text: raw.selftext ?? "", comments };
  }

  /** A subreddit's posted rules, used to check self-promotion policy. */
  async getRules(subreddit: string) {
    const sub = subreddit.replace(/^r\//i, "");
    const data = await this.get<{ rules: { short_name: string; description: string }[] }>(
      `/r/${sub}/about/rules`,
    );
    return data.rules.map((r) => ({ rule: r.short_name, description: r.description }));
  }
}
