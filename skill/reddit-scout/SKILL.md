---
name: reddit-scout
description: Find recent Reddit threads where a Pekin the Chef reply would genuinely help (meal prep, dinner ideas, recipe sites, popular recipe posts), triage them, and draft replies. Use when asked to pull, find, or check Reddit posts, or to draft Reddit comments for Pekin.
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

Keep a post when it fits one of these shapes (matches the user's own examples):

1. **Help request** — someone asking for meal prep, dinner, quick-meal, or beginner cooking ideas ("Easiest meal prep for beginner?", "Best lazy meal prep?"). Highest value.
2. **Recipe-site / tool question** — asking for recipe websites, meal planners, or how to stay consistent cooking at home.
3. **Popular recipe showcase** — a high-vote homemade or restaurant-inspired dish post (baking, copycats, "my go-to dish now"). Lower value; only keep when score is high or the thread is active.

Drop:
- Posts older than 7 days unless the thread is still active.
- Locked/archived threads, memes, rants, health/medical or weight-loss diet threads, anything where a food-business reply would read as tone-deaf.
- Threads where Pekin, HelloFresh or similar services have already been mentioned several times.

Rank: help requests first, then by recency, then by comments (active threads get seen).

## 3. Present

Lead with one line on how many came back and how many made the cut. Then a numbered list, one block per post:

```
[Title](url)
r/Subreddit · 123 votes · 45 comments · 6h ago
matched keyword
One line: why it fits and the angle a reply could take.
Self-promo: allowed / not allowed / unclear — (from subreddit_rules when checked)
```

Stop there and wait for the user's take on each post. Don't draft replies until they ask.

## 4. Draft replies (when asked)

- Call `get_post` first so the reply answers what was actually asked and doesn't repeat top comments.
- Call `subreddit_rules` for that subreddit. If self-promotion is banned or restricted, draft a reply with no Pekin mention and say why.
- Style, from the user's example: short, lowercase-casual, leads with a concrete, useful answer (specific dish, temp, timing tip). Pekin is mentioned at most once, framed honestly as the user's own business ("my small business sees this come up…"), never as a neutral third-party recommendation, and usually alongside other options.
- Never invent experiences, reviews or testimonials, and never write as if from an unaffiliated user.
- Don't post or comment on Reddit; the user posts their own replies.

## Learning from the user

When the user responds to a shortlist (keeps, skips, edits to drafts), note the pattern in your reply and suggest updating this skill's triage rules or the keyword list in `src/config.ts` of the reddit-scout repo.
