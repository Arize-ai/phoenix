# Typefully

Typefully holds the drafts a human reviews and publishes. This skill creates and updates drafts.
It never schedules, plans, or publishes unless the user asks in this session.

## Connect

The Typefully MCP server is a claude.ai connector (`mcp__claude_ai_Typefully_MCP__*`). If only
`authenticate` shows, ask the user to run `/mcp` and sign in to **claude.ai Typefully MCP**. The
tools are deferred, so load the ones you need with ToolSearch before the first call.

Post from the **Phoenix** social set (`list_social_sets`; id 266938 at the time of writing). It
holds X @ArizePhoenix, the Arize Phoenix LinkedIn company page, and Bluesky
arize-phoenix.bsky.social. The other sets in the team are the Arize company account and personal
accounts. Never draft into them unless the user names them.

## Media

Upload each file to Typefully. A GCS URL alone cannot be attached.

1. `create_media_upload` with `file_name` and `alt_text`. Set the alt text here: it is copied into
   the draft when the media is attached.
2. PUT the raw bytes to the returned `upload_url` with no extra headers: `curl -T <file> '<url>'`.
   Any header breaks the signature (403).
3. Poll `get_media_status` until `status` is `ready`, then pass the `media_id` in a post's
   `media_ids`.

The GCS URLs from `stage-media.sh` are the durable copies. List them in the draft notes.

## One draft per post

A release that goes to X as a thread and to LinkedIn as one post is **one draft** with both
platforms enabled and different `posts` per platform. Two different posts (a release and a tip)
are two drafts. `create_draft` returns a `private_url`; report it.

| Field | Convention |
|---|---|
| `draft_title` | `[<type>] <subject> — <YYYY-MM-DD>`, e.g. `[release] Decision-model judges, OTel JS 3 — 2026-11-18` |
| `platforms` | X, LinkedIn, and Bluesky on every draft (SKILL.md step 1). Each X or Bluesky post in a thread is one item in `posts`; LinkedIn gets one |
| `scratchpad_text` | Plain text notes: post type, sources (PRs, docs, release note), the GCS media URLs, credits to confirm, anything unverified, and how this draft overlaps others |
| `tags` | Slugs of existing tags only. Use the post type (`release`, `feature`, `tip`, `deep-dive`, `integration`, `community`) plus `breaking`. Create a missing tag only with the user's OK |
| `publish_at`, `plan_at`, `share` | Leave unset |

LinkedIn takes `settings.first_comment`, which suits a link the reviewer wants out of the post
body.

## Updating

Revise by updating the same draft with `edit_draft`, not by creating a new one. `get_draft` first:
a reviewer may have edited the draft or left comments in Typefully, and their edits win. Keep the
comment-thread markers in the text exactly as `get_draft` returns them.

## Report

Return each draft's title, its `private_url`, the platforms it targets, and the media attached.
