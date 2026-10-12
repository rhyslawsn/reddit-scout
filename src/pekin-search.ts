// Pekin lookups against the Typesense mirror (fast, typo-tolerant) and the
// public Pekin API (full recipes). Neither needs database credentials.
//
// Typesense documents (see rhyslawsn/pekin-the-chef apps/api/src/lib/typesense/lib/recipes.ts):
//   { id, title, description, authorName, authorUsername, authorCity?, slug, ingredients[], ... }
// Delisted recipes are removed from the index.

const SITE = "https://pekinthechef.com";
const STOP = new Set(["the", "and", "with", "of", "in", "on", "a", "an", "restaurant", "recipe", "copycat"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when every meaningful word in `query` appears in `target` (prefix match allowed). */
const coversAll = (query: string, target: string) => {
  const t = words(target);
  const q = words(query);
  return q.length > 0 && q.every((w) => t.some((x) => x.startsWith(w) || w.startsWith(x)));
};

type Doc = {
  id: string;
  title: string;
  authorName?: string;
  authorUsername: string;
  authorCity?: string | null;
  slug: string;
};

export class PekinSearch {
  constructor(
    private baseUrl: string, // e.g. https://typesense-production-xxxx.up.railway.app
    private apiKey: string, // search-only key
    private collection: string,
  ) {}

  private async search(params: Record<string, string | number>): Promise<Doc[]> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/collections/${encodeURIComponent(this.collection)}/documents/search?${qs}`,
      { headers: { "X-TYPESENSE-API-KEY": this.apiKey }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`Typesense ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { hits?: { document: Doc }[] };
    return (data.hits ?? []).map((h) => h.document);
  }

  async lookup(opts: { restaurant?: string; dish?: string; city?: string; limit?: number }) {
    const limit = Math.min(opts.limit ?? 10, 25);
    const fields = "id,title,authorName,authorUsername,authorCity,slug";
    const cityOk = (d: Doc) => !opts.city || !d.authorCity || d.authorCity.toLowerCase().includes(opts.city.toLowerCase());

    // 1. Restaurants
    let confirmed: Array<{ username: string; name: string; city: string | null; url: string }> = [];
    let possible: typeof confirmed = [];
    if (opts.restaurant) {
      const docs = await this.search({
        q: opts.restaurant,
        query_by: "authorName,authorUsername",
        per_page: 100,
        num_typos: 1,
        include_fields: fields,
      });
      const byAuthor = new Map<string, Doc>();
      for (const d of docs) if (!byAuthor.has(d.authorUsername) && cityOk(d)) byAuthor.set(d.authorUsername, d);
      const all = [...byAuthor.values()].map((d) => ({
        username: d.authorUsername,
        name: (d.authorName ?? "").trim() || d.authorUsername,
        city: d.authorCity ?? null,
        url: `${SITE}/${d.authorUsername}`,
      }));
      const q = squash(opts.restaurant);
      confirmed = all.filter(
        (a) => squash(a.username).includes(q) || squash(a.name).includes(q) || coversAll(opts.restaurant!, a.name),
      );
      possible = all.filter((a) => !confirmed.includes(a)).slice(0, 3);
    }

    // 2. Dishes
    let dishes: Array<{ title: string; restaurant: string; restaurant_slug: string; city: string | null; url: string; match: "all words" | "partial" }> = [];
    if (opts.dish && !(opts.restaurant && confirmed.length === 0)) {
      const base = { q: opts.dish, query_by: "title", per_page: 50, num_typos: 1, include_fields: fields };
      let docs: Doc[];
      const usernames = confirmed.map((c) => c.username);
      try {
        docs = await this.search(
          usernames.length ? { ...base, filter_by: `authorUsername:=[${usernames.map((u) => `\`${u}\``).join(",")}]` } : base,
        );
      } catch {
        // authorUsername may not be filterable in the schema; filter client-side instead.
        docs = (await this.search(base)).filter((d) => !usernames.length || usernames.includes(d.authorUsername));
      }
      dishes = docs
        .filter(cityOk)
        .map((d) => ({
          title: d.title,
          restaurant: (d.authorName ?? "").trim() || d.authorUsername,
          restaurant_slug: d.authorUsername,
          city: d.authorCity ?? null,
          url: `${SITE}/${d.authorUsername}/${d.slug}`,
          match: coversAll(opts.dish!, d.title) ? ("all words" as const) : ("partial" as const),
        }))
        .sort((a, b) => (a.match === b.match ? 0 : a.match === "all words" ? -1 : 1))
        .slice(0, limit);
    }

    const note =
      opts.restaurant && confirmed.length === 0
        ? possible.length
          ? "Restaurant not found by name; see possible_matches (verify before using)."
          : "Restaurant not on Pekin."
        : opts.dish && !dishes.some((d) => d.match === "all words")
          ? dishes.length
            ? "No exact dish match; only partial matches."
            : "No matching dish found."
          : undefined;

    return { source: "typesense", restaurants: confirmed.slice(0, limit), possible_matches: possible, dishes, note };
  }
}

/** Full recipe from the public Pekin API (same endpoint the website uses). */
export async function fetchPekinRecipe(urlOrPath: string, apiBase = "https://api.pekinthechef.com") {
  const m = urlOrPath.match(/(?:pekinthechef\.com)?\/?([a-z0-9._-]+)\/([a-z0-9._-]+)\/?(?:[?#].*)?$/i);
  if (!m) throw new Error("Give a pekinthechef.com recipe URL like https://pekinthechef.com/{restaurant}/{dish}");
  const [, username, slug] = m;
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/recipes/${username.toLowerCase()}/${slug.toLowerCase()}`, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "reddit-scout (Pekin internal tool)" },
  });
  if (res.status === 404 || res.status === 410) throw new Error("Recipe not found on Pekin");
  if (!res.ok) throw new Error(`Pekin API ${res.status}`);
  const body = (await res.json()) as { data?: { recipe?: Record<string, any> } };
  const r = body.data?.recipe;
  if (!r) throw new Error("Recipe not found on Pekin");
  const author = r.author?.username ?? username;
  return {
    id: r.id,
    title: r.title,
    restaurant: r.author?.firstName || author,
    url: `${SITE}/${author}/${r.slug ?? slug}`,
    description: r.enrichedDescription ?? r.description,
    servings: r.servings,
    estimated_minutes: r.estimatedTime,
    ingredients: r.nextIngredients,
    directions: r.nextDirections,
  };
}
