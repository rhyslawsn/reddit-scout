---
name: pekin-recipe
description: Pull a full Pekin the Chef recipe (ingredients with quantities, directions, servings, time) by pekinthechef.com URL or recipe id. Use when a reply, newsletter blurb, pairing note or other content needs to be grounded in what's actually in a Pekin recipe.
---

# Pekin recipe

Gets the real ingredients and method for a Pekin recipe so anything written about it is accurate.

## How

1. Need a URL or id first? Use the **pekin-lookup** skill.
2. Call `pekin_recipe` from the **reddit-scout** connector with the pekinthechef.com URL (`/{restaurant-slug}/{recipe-slug}`). It reads the public Pekin API, the same data the recipe page shows. Load it with ToolSearch if deferred.
3. It returns `title`, `restaurant`, `url`, `description`, `servings`, `estimated_minutes`, `ingredients` and `directions`. Ingredients and directions come in sections:
   - ingredients: `[{ section, ingredients: [{ name, quantity, unit }] }]`
   - directions: `[{ section, directions: [{ title, description }] }]`
   Older recipes may return flat string lists instead; handle both.
4. Error "Recipe not found on Pekin" means the URL is wrong or the recipe was removed.

## Fallback (connector not available)

WebFetch the recipe URL and ask for the ingredients with quantities and the steps. WebFetch may paraphrase the steps; quantities come through reliably. Say it came from the public page.

## Using the result

- Quote quantities and ingredients exactly; don't round, swap or invent ingredients.
- When rewriting the method for another context (a Reddit reply, a newsletter line), keep the key ratios and order of steps and state it in the target voice.
- Whether to name or link Pekin is up to the calling context (e.g. the reddit-scout skill follows each subreddit's self-promotion rules). This skill only fetches.
