# Platforms

Write each platform's copy for that platform. Limits below are what to design for, not the hard
maximums.

| | X | LinkedIn | Bluesky | Threads |
|---|---|---|---|---|
| Length | ≤ 280 weighted chars per post: URLs at full length, CJK and emoji count 2 (`scripts/x_length.py`) | ≤ 1,300 chars; the first ~200 show before "see more" | ≤ 300 chars | ≤ 500 chars |
| Threads | Yes, 2–8 posts | No; one post | Yes | Yes |
| Media per post | 4 images or 1 video | 1 video, up to ~9 images, or a PDF carousel | 4 images or 1 video | 10 images or 1 video |
| Image shape | 16:9 (1920×1080) | 4:5 (1080×1350) or 1:1 | 16:9 | 4:5 or 1:1 |
| Code | Inline `backticks` render as plain text; use a code card for more than one line | Same | Same | Same |
| Links | In the last post of a thread | In the body | Anywhere | Anywhere |
| Mentions | @handle | Company pages: `@[Name](urn:li:organization:<id>)`, with the URN from the MCP's LinkedIn organization lookup. People: name only; the reviewer tags them in Typefully | @handle.bsky.social | @handle |
| Hashtags | None | 0–2, at the end | None | None |

Notes:

- **X first lines** decide everything: the timeline truncates long posts and shows the first post
  of a thread. The first post must stand alone.
- **X length:** X shortens links to 23 characters, but Typefully blocks a post on a non-Premium
  account when the raw text is over 280. Count every character, and move a long URL into its own
  post or link a shorter page when a post doesn't fit.
- **LinkedIn** has no markdown. Use short lines and blank lines, not bullets with symbols. Code
  belongs in the image; at most one short command inline.
- **One draft, every platform.** Bluesky takes the X text and media unchanged; check each post
  against its 300-character limit. LinkedIn has no threads, so a thread becomes one post with one
  asset: the headline feature plus a short "Also in this release" list.
- **LinkedIn favors video.** When the LinkedIn post's headline feature has a video, attach the
  video rather than a still, even if X leads with a card.
- **Video** on every platform autoplays muted. The explainer-video rules (words on screen do the
  teaching) apply unchanged. Keep social videos 10–45 s; 16:9 works everywhere.
- **Alt text** on every image. Describe what the image shows and transcribe any code in it.
- Accounts and their handles come from the Typefully social set; list them with the MCP rather than
  assuming. The project's public handle on X is `@ArizePhoenix`.
