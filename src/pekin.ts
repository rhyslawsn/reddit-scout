// Read-only lookup against the Pekin the Chef database (Prisma schema in
// rhyslawsn/pekin-the-chef: restaurants are `users`, dishes are `recipes`).
import pg from "pg";

const SITE = "https://pekinthechef.com";

export class PekinDb {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      // Every session is read-only, even if the role isn't.
      options: "-c default_transaction_read_only=on -c statement_timeout=8000",
    });
  }

  private async q<T extends pg.QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  /**
   * Find restaurants by name and/or dishes by title. Matching ignores case,
   * spaces and punctuation ("The Public Kitchen & Bar" ~ "thepublickitchenbar").
   */
  async lookup(opts: { restaurant?: string; dish?: string; city?: string; limit?: number }) {
    const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const r = norm(opts.restaurant);
    const d = (opts.dish ?? "").trim();
    const c = (opts.city ?? "").trim();
    const limit = Math.min(opts.limit ?? 10, 25);

    const cityExpr = `(select comp->>'long_name' from jsonb_array_elements(case when jsonb_typeof(u.address) = 'array' then u.address else '[]'::jsonb end) comp
                        where comp->'types' ? 'locality' limit 1)`;
    const nameExpr = `trim(coalesce(u."firstName",'') || ' ' || coalesce(u."lastName",''))`;

    const restaurants = r
      ? await this.q<{ username: string; name: string; city: string | null; recipe_count: number }>(
          `select u.username, ${nameExpr} as name, ${cityExpr} as city,
                  (select count(*)::int from recipes x where x."authorId" = u.id and x."delistedAt" is null) as recipe_count
             from users u
            where (regexp_replace(lower(u.username), '[^a-z0-9]', '', 'g') like '%' || $1 || '%'
                or regexp_replace(lower(${nameExpr}), '[^a-z0-9]', '', 'g') like '%' || $1 || '%')
              and ($2 = '' or ${cityExpr} ilike '%' || $2 || '%')
            order by length(u.username) asc
            limit $3`,
          [r, c, limit],
        )
      : [];

    let dishes: Array<{ title: string; restaurant: string; restaurant_slug: string; city: string | null; url: string; id: number }> = [];
    if (d && !(r && restaurants.length === 0)) {
      const restaurantFilter = restaurants.map((x) => x.username);
      const rows = await this.q<{ id: number; title: string; slug: string | null; username: string; name: string; city: string | null }>(
        `select x.id, coalesce(x."enrichedTitle", x.title) as title, x.slug, u.username, ${nameExpr} as name, ${cityExpr} as city
           from recipes x join users u on u.id = x."authorId"
          where x."delistedAt" is null
            and not exists (select 1 from unnest($1::text[]) w
                             where (x.title || ' ' || coalesce(x."enrichedTitle", '')) not ilike '%' || w || '%')
            and (cardinality($2::text[]) = 0 or u.username = any($2::text[]))
            and ($3 = '' or ${cityExpr} ilike '%' || $3 || '%')
          order by (u.username = any($2::text[])) desc, x."ratingCount" desc, x.id
          limit $4`,
        [d.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !["and", "the", "with", "of", "in", "on"].includes(w)), r ? restaurantFilter : [], c, limit],
      );
      dishes = rows.map((x) => ({
        id: x.id,
        title: x.title,
        restaurant: x.name || x.username,
        restaurant_slug: x.username,
        city: x.city,
        url: x.slug ? `${SITE}/${x.username}/${x.slug}` : `${SITE}/${x.username}`,
      }));
    }

    return {
      restaurants: restaurants.map((x) => ({ ...x, url: `${SITE}/${x.username}` })),
      dishes,
      note:
        r && restaurants.length === 0
          ? "Restaurant not on Pekin."
          : d && dishes.length === 0
            ? "No matching dish found."
            : undefined,
    };
  }

  /** Full recipe by id or pekinthechef.com URL. */
  async recipe(idOrUrl: string) {
    const m = idOrUrl.match(/pekinthechef\.com\/([^/?#]+)\/([^/?#]+)/);
    const rows = m
      ? await this.q(
          `select x.*, u.username, trim(coalesce(u."firstName",'') || ' ' || coalesce(u."lastName",'')) as restaurant
             from recipes x join users u on u.id = x."authorId"
            where u.username = $1 and x.slug = $2 and x."delistedAt" is null limit 1`,
          [m[1], m[2]],
        )
      : await this.q(
          `select x.*, u.username, trim(coalesce(u."firstName",'') || ' ' || coalesce(u."lastName",'')) as restaurant
             from recipes x join users u on u.id = x."authorId"
            where x.id = $1 and x."delistedAt" is null limit 1`,
          [Number(idOrUrl)],
        );
    const x = rows[0] as Record<string, any> | undefined;
    if (!x) throw new Error("Recipe not found on Pekin");
    return {
      id: x.id,
      title: x.enrichedTitle ?? x.title,
      restaurant: x.restaurant || x.username,
      url: x.slug ? `${SITE}/${x.username}/${x.slug}` : `${SITE}/${x.username}`,
      description: x.description,
      servings: x.servings,
      estimated_minutes: x.estimatedTime,
      ingredients: x.nextIngredients?.length ? x.nextIngredients : x.ingredients,
      directions: x.nextDirections?.length ? x.nextDirections : x.directions,
    };
  }
}
