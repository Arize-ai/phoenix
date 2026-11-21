---
name: phoenix-social
description: >
  Draft Phoenix social media posts — release announcements, feature spotlights, code tips, threads,
  integration launches, and community posts — grounded in the shipped code, with the right media
  (screenshots, code cards, explainer videos), staged on GCS and saved as Typefully drafts for review.
  Use whenever someone wants a tweet, thread, LinkedIn post, Bluesky post, social copy, a launch
  announcement, or "something to post" about a Phoenix release, PR, feature, docs page, integration,
  or milestone, or asks to put posts into Typefully. Also use to audit or clean up the Typefully
  drafts, including replies and posts in languages other than English.
metadata:
  internal: true
---

# Phoenix Social

Turn something Phoenix shipped into posts a developer would stop scrolling for. Each run ends with
media on GCS and one Typefully draft per post, ready for a human to review and publish. Never
publish or schedule unless the user asks.

Three things decide quality, in this order:

1. **The facts are right.** Every name, flag, version, and number matches the shipped code.
2. **The artifact shows the thing.** A real screenshot, real code, or a short explainer beats any
   sentence about it.
3. **The copy sounds like the engineer who built it**, explaining it to a peer. See
   [references/voice.md](references/voice.md).

## Workflow

### 1. Pin down the intent

Work out the subject (release, PR, feature, docs page, integration, milestone), the audience, the
post type, and the platforms. The post types and their shapes are in
[references/post-types.md](references/post-types.md); treat them as starting points, not a closed
list. Every draft goes to X, LinkedIn, and Bluesky, the three accounts in the Phoenix social set.
If a post leaves a platform out, say why in the draft notes.

Find the author's intent: what problem they set out to solve and what they are proud of. Read the
PR description, linked issues, and review threads. If the user is the author, their framing wins.
Ask one question only when the angle is genuinely ambiguous; otherwise pick the strongest angle and
say which one you picked.

### 2. Gather facts from the source

Read the code, not only commit messages. The `phoenix-release-notes` skill (Step 2) has the map of
where features live and how to rank them; reuse its ranking for multi-feature posts. If a release
note page already exists, start from it, then verify snippets against the source.

Collect into `brief.md` in a working directory (`<scratchpad>/social/<YYYY-MM-DD>-<slug>/`, or
where the user says):

- The one-sentence point of the post, in the author's terms
- Exact UI labels, API and CLI names, real output, and minimum versions
- Links: docs page (`https://arize.com/docs/phoenix/...`), release note, GitHub release or PR
- Credits: PR authors and community contributors, with the accounts they list on GitHub:

  ```bash
  .agents/skills/phoenix-social/scripts/lookup-handles.sh <github-login> [...]
  ```

  It prints each user's name and their X, Bluesky, and LinkedIn accounts, or `-` when none is
  listed. Use only handles it prints or the user gives you; never guess one from a name or login

### 3. Make the artifacts

Choose media by what the feature *is*; see [references/media.md](references/media.md) for the
decision table, sizes, and how to drive the other skills:

| Feature is mostly… | Make |
|---|---|
| UI | Real screenshot or short screen capture (`phoenix-pr-screenshot` steps 1–3) |
| API, SDK, or CLI | Code card rendered from real code (explainer template, one scene) |
| A concept or multi-step workflow | Explainer video (`phoenix-explainer-video`) |
| An integration | Logo lockup card (`phoenix-docs` card renderer) plus a code card or trace screenshot |

One strong asset per post. A thread gets at most one asset per post. Look at every rendered file
before you use it, and write alt text for each image.

### 4. Write the copy

Write per platform, not one text pasted everywhere; limits and formatting are in
[references/platforms.md](references/platforms.md). Put the copy in `posts.md` next to the brief so
it can be revised and re-staged.

- The first line carries the post. It names the capability in concrete terms.
- Show the change: code, command, or the before/after a user feels.
- One link, to the most useful page (usually docs or the release note).
- Credit contributors in the post about their work. Tag a confirmed handle on platforms that
  support it (X, Bluesky); otherwise use the person's name. LinkedIn personal tags can't be set
  through the MCP, so write the name and note in the draft that the reviewer can tag them in
  Typefully.

### 5. Stage media on GCS

```bash
.agents/skills/phoenix-social/scripts/stage-media.sh <YYYY-MM-DD>-<slug> <files...>
```

Files go to `gs://arize-phoenix-assets/social/<YYYY-MM-DD>-<slug>/` and become public at
`https://storage.googleapis.com/arize-phoenix-assets/social/...`. The script refuses to overwrite an
existing object. Only stage media for released features; anything in the bucket is public.

### 6. Create Typefully drafts

Follow [references/typefully.md](references/typefully.md): upload each file to Typefully with its
alt text, then make one draft per post in the Phoenix social set, named and tagged consistently,
with sources and the GCS URLs in the draft notes. Create drafts only — no scheduling or publishing
without an explicit ask.

### 7. Report

List each draft with its Typefully link, the platforms it targets, its media URLs, and any fact you
could not verify against the code. Show the X copy inline so the user can react without opening
Typefully.

## Checks before staging

- [ ] Every code line, flag, label, and version matches the source; snippets run as written
- [ ] The first line works alone, without the media or the rest of the post
- [ ] Each platform's copy fits its limit (`scripts/x_length.py` for X) and reads natively there
- [ ] No competitor names, no hype words, no engagement bait (see voice reference)
- [ ] Every image is legible at phone width and has alt text
- [ ] Links resolve and point at public pages; no internal paths, PR numbers in place of value, or
      unreleased features

## Audit and cleanup

To review the drafts already in Typefully, follow [references/audit.md](references/audit.md). It
covers stale replies, empty drafts, and extra checks for posts that aren't in English. It reports
before it changes anything, and deletes only the drafts the user names.
