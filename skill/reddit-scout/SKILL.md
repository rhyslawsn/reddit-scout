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
2. **Recipe-site / tool / planning question** — asking for recipe websites, apps, meal planners, or how to stay consistent.
3. **Popular recipe showcase** — a high-vote homemade or restaurant-inspired dish post. Lower value; only keep when score is high or the thread is active.

Drop:
- Posters who say they **don't enjoy cooking** or want zero-effort food (frozen meals, no chopping, "lazy meals"). Not Pekin's audience.
- Posts older than 7 days unless the thread is still active.
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

Stop there and wait for the user's take on each post. Don't draft replies until asked.

## 4. Draft replies (when asked)

- Call `get_post` first so the reply answers what was actually asked and doesn't repeat top comments.
- If the subreddit **bans AI-written comments**, don't draft. Give the user a few bullet ideas they can write up themselves.
- If the subreddit **bans self-promotion**, draft with no Pekin mention.
- If self-promotion is allowed or limited, Pekin can come in once, near the end, and must be disclosed as Rhys's own project (e.g. "full disclosure, I run it"). Never write as if from an unaffiliated user, and never invent experiences, reviews or testimonials.
- Don't reuse the same text across threads; Reddit flags near-identical comments as spam. Vary wording and tailor to each post.
- Never post to Reddit. The user posts his own replies.

### Rhys's voice

- First person, conversational, normal sentence case, short (3–6 sentences).
- Uses "my partner and I" and what they actually do at home.
- When the poster is venting or overwhelmed, open with a short empathy line ("I feel you.").
- Give a concrete framework, not a list of dishes. His go-to is **weekly menus**: pick 2 proteins and a sauce for the week, vary the base each day (rice, potatoes, salad, etc.), shop once; about 1.5 hours including shopping.
- Tailor the framework to the poster's main concern (cost → "keeps prices low" / "uses everything you buy"; time → "takes maybe 1.5 hours").
- Pekin angle when allowed: when feeling uninspired, think of restaurants around town you like and look up copycat recipes for them on Pekin the Chef.
- For narrow technical asks (e.g. cold lunches, no microwave), just give ideas: pasta salads, marinated veggies, grain salads. No Pekin mention.

### Reference replies (Rhys's own wording)

On "can't spend four hours prepping on Sunday, any tools?":
> I feel you. Spending that amount of time on a Sunday is a lot. My partner and I do "weekly menus" which has helped a ton. Think of 2 proteins you want that week, a sauce and then choose different bases (rice, potatoes, salad, etc.) for each day. Then just go out and shop for it. Takes maybe 1.5 hours including the shopping. If I'm feeling uninspired and bored I also think of restaurants around town I really like and search up copycat recipes for them using Pekin the Chef

On "moved out alone, want to cook cheaply and plan meals":
> My partner and I do "weekly menus" which has helped a ton on keeping prices low. Think of 2 proteins you want that week, a sauce and then choose different bases (rice, potatoes, salad, etc.) for each day. Then just go out and shop for it. Takes maybe 1.5 hours including the shopping and lets you make the most of the ingredients bought. If I'm feeling uninspired and bored I also think of restaurants around town I really like and search up copycat recipes for them using Pekin the Chef

Skipped: a couple who "don't enjoy cooking" and wanted no-chop, no-stovetop meals. Reason: not the audience.

On "new to meal prep, can't heat lunch": suggest pasta salads, marinated veggies, etc. No Pekin mention.

## Learning from the user

When the user responds to a shortlist (keeps, skips, edits to drafts), note the pattern and suggest updating this skill's triage rules or voice notes, or the keyword list in `src/config.ts` of the rhyslawsn/reddit-scout repo.
