---
name: reddit-scout
description: Find recent Reddit threads where a Pekin the Chef reply would help (meal prep, dinner ideas, recipe sites, popular recipe posts), triage them, and draft replies in Rhys's voice.
---

# Reddit scout for Pekin the Chef

Pulls fresh Reddit threads through the **reddit-scout** connector (tools: `scout_feed`, `search_posts`, `list_new`, `get_post`, `subreddit_rules`), shortlists the ones worth answering, and drafts replies on request.

If the connector's tools aren't available, say so in one line and ask the user to enable the reddit-scout connector for this chat. Don't fall back to web search; it returns stale, undated results.

## 1. Pull

- Default: call `scout_feed` with no arguments (built-in keyword list, food subreddits, past week).
- The user names a topic → `search_posts` with that query (sort `new`, time `week` unless they say otherwise).
- The user names a subreddit → pass it in `subreddits`.
- The user wants something broader → `scout_feed` with `subreddits: []` (all of Reddit).

## 2. Triage

**Audience:** people who want to cook but need inspiration, structure or a plan. Pekin is for them.

Keep a post when it fits one of these shapes:

1. **Help request from someone who wants to cook** — asking for meal prep, dinner, weekly planning, or beginner ideas; bored of their rotation; trying to cook more at home or spend less. Highest value.
2. **Copycat / restaurant-recipe request** — someone trying to recreate a restaurant, bakery or fast-food dish, or wanting food that tastes "restaurant style". Pekin's core audience; rank alongside help requests. Look in r/TopSecretRecipes, local city subs (search "copycat" across all of Reddit), and cooking subs.
3. **Recipe-site / tool / planning question** — asking for recipe websites, apps, meal planners, or how to stay consistent.
4. **Popular recipe showcase** — a high-vote homemade or restaurant-inspired dish post. Lower value; only keep when score is high or the thread is active.

Drop:
- Posters who say they **don't enjoy cooking** or want zero-effort food (frozen meals, no chopping, "lazy meals"). Not Pekin's audience.
- Posts older than 7 days unless the thread is still active.
- Posts about cooking for babies, toddlers or young kids.
- Copycat requests already answered (a top comment names the exact product or recipe and the poster seems satisfied).
- Likely bot posts (brand-new account, generic question, commenters calling it a bot).
- Locked/archived threads, memes, rants, health/medical, weight-loss diet, or sensitive family/feeding situations where a food-business reply would read as tone-deaf.
- Threads where the poster has already thanked everyone and summarised the answers.
- Threads where Pekin, HelloFresh or similar services have already been mentioned several times.

Rank: help requests first, then recency, then comment count.

Run `subreddit_rules` once per subreddit in the shortlist and record two things: whether self-promotion is allowed, and whether AI-written comments are banned.

## 3. Present

Lead with one line: how many came back, how many made the cut. Then a numbered list, one block per post, with the **post's raw text verbatim** (don't summarise it; keep the poster's typos and edits):

```
**[Title](url)**
r/Subreddit · 123 votes · 45 comments · 6h ago · matched: keyword
> raw post body, quoted in full
Angle: one line on what a reply could offer.
Rules: self-promo allowed / limited / banned · AI comments allowed / banned
```

Use `get_post` to fetch the full body when `selftext_snippet` is truncated (ends in "…"). For image/link posts with no body, say "(image post, no text)".

Under each block, include a **Proposed comment** following step 4. For subreddits that ban AI-written text, still include the draft but mark it "rewrite in your own words before posting"; Rhys writes his own final comments.

Then wait for his take on each post.

## 4. Draft replies

**Subreddit rules come first and override everything else in this skill, including the voice notes and reference replies.** Before writing any draft:

1. Call `subreddit_rules` for that subreddit (even if it was checked during triage) and `get_post` for the thread.
2. Read every rule, not just the self-promotion one. Look for: self-promotion, links/external domains, AI-generated content, required formats, topic scope, no-DM rules, flair restrictions (e.g. no recipe requests on Showcase posts), and anything stickied or in the post flair that limits replies.
3. Apply the strictest reading:
   - **AI-written comments banned** → don't draft. Give a few bullet points of ideas Rhys can write up himself, and say why.
   - **Self-promotion banned** (including naming a site or brand without a link) → no Pekin mention at all, not even unlinked.
   - **Self-promotion limited/allowed** → only mention Pekin if it's genuinely the answer (e.g. the poster asks for recipe sites); Rhys usually leaves it out. If used: at most once, near the end, disclosed as Rhys's own project (e.g. "full disclosure, I run it"). Unlinked unless the rules clearly allow links.
   - **Links restricted** → no links of any kind.
   - **Rule unclear** → treat it as banned and flag it.
   - r/TopSecretRecipes allows self-promotion only in its Saturday megathread; r/Cooking has a weekly self-promo thread. Point Rhys there instead of putting Pekin in a reply.
4. Above every draft, show a one-line compliance check, e.g. `Rules: r/X — self-promo banned, AI ok → no Pekin mention`.

Also:
- Answer what was actually asked and don't repeat top comments; build on them if they're close.
- Copycat requests: never claim insider knowledge or that Rhys has eaten somewhere. Offer an honest best guess ("haven't had theirs, but if it's creamy and slightly sweet I'd start with…") with specific ingredients and ratios.
- Links: only if the rules allow outside links and the site doesn't need a login (several subs ban Instagram/Facebook/TikTok links). Never link Pekin.
- Personal details: use only what Rhys has actually said about himself (e.g. weekly menus, lived in small-town Canada last year). Never invent backstory.
- Never write as if from an unaffiliated user, and never invent experiences, reviews or testimonials.
- Don't reuse the same text across threads; Reddit flags near-identical comments as spam. Vary wording and tailor to each post.
- If Rhys pastes his own reply and it would break a rule, say which rule and suggest the compliant version.
- Never post to Reddit. Rhys posts his own replies.

### Rhys's voice

- First person, conversational, normal sentence case, short (3–6 sentences).
- Uses "my partner and I" and what they actually do at home.
- Lead with the useful part. No flattery openers ("Not a silly question", "Love that you're…", "Honestly technique…").
- When the poster is venting or relatable, a short empathy line is fine ("I feel you!"), backed by something real.
- Use specific technique: golden sear, deglazing and pan sauces, basting, blanching, finishing with acid.
- Sometimes end with a question back to the poster ("Curious what ingredients you're missing?").
- Give a concrete framework, not a list of dishes. His go-to is **weekly menus**: pick 2 proteins and a sauce for the week, vary the base each day (rice, potatoes, salad, etc.). They don't cook on Sunday; they shop for it and maybe prep some ingredients so it's ready for the week. Inspiration: Zoe Barrie (@itszoebarrie).
- Tailor the framework to the poster's main concern (cost → "keeps prices low" / "uses everything you buy"; time → shopping + light prep instead of a full cook day).
- Pekin angle, only where the rules allow it: when feeling uninspired, think of restaurants around town you like and look up copycat recipes for them on Pekin the Chef.
- For narrow technical asks (e.g. cold lunches, no microwave), just give ideas: pasta salads, marinated veggies, grain salads. No Pekin mention.

### Reference replies (Rhys's own wording)

These show voice and structure only. Step 4's rules still apply when reusing them.

"3 hours a week prepping for a family, am I doing it wrong?" (r/MealPrepSunday):
> 3 hours for a family is honestly feels pretty normal to me. My partner and I do "weekly menus" where we choose 2 proteins, once sauce and a base for each day. We don't actually make these on Sundays, but shop for them and maybe prep some of the ingredients so it's ready for the week. [Zoe Barrie's Instagram] has been a big inspiration for this. It scales up for a family pretty easily since you're just making bigger batches

(Check link rules before keeping a link: r/MealPrepSunday bans using the sub to drive traffic to outside sites.)

"Lentils and beans all taste the same" (r/MealPrepSunday):
> The trick that helped us with repetitive flavours is to keep the base the same and change the sauce every week. Lentils and beans take on whatever you put them in. A few that switch it up from your Mediterranean soup that come to mind are: dal with lots of cumin, garlic and ginger; chana masala with chickpeas in a tomato and garam masala sauce; black bean chili with smoked paprika and lime; white beans with garlic, lemon and kale; red lentils in coconut milk with curry paste. Same prep, completely different week. For protein, stirring in some Greek yogurt or a fried egg on top goes a long way.

"How do I elevate my cooking with limited ingredients?" (r/Cooking):
> I feel you! I lived in small town Canada last year and ran into this a lot. What I found is technique goes a long way when you don't have fancy ingredients. Perfect a golden sear on dried meat, experimenting with different deglazing and pan sauces, basting meats, blanching, the list goes on. Curious what kinds of ingredients are you missing?

"Easy salad lunches" (r/Cooking):
> Greek salad with roasted chickpeas thrown in, rotisserie chicken with grapes, celery and a lemony yogurt dressing, and cucumber, edamame and shredded cabbage with a sesame-soy dressing. Another fun one is thinking of café or restaurant you like and trying a copycat recipe from there. It's usually just a good dressing and one or two standout toppings. Make the dressing on Sunday and you're set for the week.

"What 3-5 meals do you cook most?" (r/Cooking):
> We pick 2 proteins and one sauce, then switch up the base each night, so the same chicken ends up in a rice bowl one night and a salad the next.

Earlier, where the rules allowed a mention ("moved out alone, want to plan meals cheaply", r/EatCheapAndHealthy): weekly menus framed around keeping prices low and using everything bought, ending with looking up copycats of favourite local restaurants on Pekin the Chef (add a disclosure that he runs it).

Skipped: a couple who "don't enjoy cooking" (not the audience); a friend learning to cook for a toddler and newborn (cooking for kids).

## Learning from the user

When the user responds to a shortlist (keeps, skips, edits to drafts), note the pattern and suggest updating this skill's triage rules or voice notes, or the keyword list in `src/config.ts` of the rhyslawsn/reddit-scout repo.
