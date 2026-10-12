---
name: pekin-lookup
description: Check whether Pekin the Chef has a restaurant or dish (by name, dish or city) and get its pekinthechef.com URLs. Use before answering copycat requests, pitching or writing about a restaurant, or any "is X on Pekin?" question.
---

# Pekin lookup

Answers one question: **is this restaurant and/or dish on Pekin, and where?**

## How

1. Use the `pekin_lookup` tool from the **reddit-scout** connector. It searches the Typesense mirror of the Pekin database (fast, typo-tolerant; delisted recipes aren't indexed). Load it with ToolSearch if it's deferred.
   - `restaurant`: the name as people write it ("The Public", "Daikokuya"). Matching ignores case, spaces and punctuation.
   - `dish`: a dish name or keywords ("shrimp grits"). Filler words like "and"/"the" are ignored.
   - `city`: add it when the name is common or ambiguous ("Savannah").
   - Pass a restaurant, a dish, or both. Dish-only searches across all restaurants.
2. Read the result:
   - `note: "Restaurant not on Pekin."` → it isn't there. Say so plainly.
   - `possible_matches` with no `restaurants` → only fuzzy look-alikes (e.g. "Fiji Islands" → "Fiji Mermaid Grill"). Treat as not on Pekin unless the name, city and dishes clearly line up; never present a look-alike as the same place.
   - `restaurants` found but `note: "No matching dish found."` → the restaurant is there, the dish isn't. List the closest titles if you look them up, but don't claim a match.
   - `dishes` → each has `title`, `restaurant`, `city`, `url` and `match`. Only `match: "all words"` is a real match; `"partial"` hits are related dishes, not the one asked for. If several match, pick by restaurant and city, or show the options.
3. `city` can be empty for some restaurants; don't drop a match just because city is missing.

## Fallback (connector not available)

Fetch `https://pekinthechef.com/{restaurant-slug}` with WebFetch. The slug is the restaurant name lowercased with spaces and punctuation removed (The Public Kitchen & Bar → `thepublickitchenbar`); try one or two variants. The page lists every recipe with its URL. This only works when you know the restaurant; dish-only searches need the connector. Say which method you used if the answer is "not found", since the fallback can miss.

## Output

Lead with the answer ("Yes: The Public Kitchen & Bar, Savannah, has Savannah Shrimp & Grits" or "Not on Pekin"), then the URL(s). For the full recipe, use the **pekin-recipe** skill.
