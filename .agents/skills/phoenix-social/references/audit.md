# Audit and cleanup

Review the drafts waiting in the Phoenix social set, fix the ones worth posting, and clear the
rest. Posts in languages other than English get extra checks, because a reviewer who can't read
them can't catch a mistake.

## 1. Inventory

List every draft with `list_drafts` (`status: "draft"`, 50 per page, follow `next`). Add
`scheduled` and `planned` drafts when the user asks for the whole queue. Read each candidate in
full with `get_draft` (`exclude_comment_markers: true` for reading only).

Sort each draft into one bucket:

| Bucket | How to tell |
|---|---|
| Empty | No platform enabled, or no text, media, quote, or reshare on any enabled platform |
| Bare | No text, but media, a `quote_post_url`, a `linkedin_reshare_urn`, or only a link. Someone may have started a repost; ask before deleting |
| Reply | `platforms.x.settings.reply_to_url` is set, or the title starts with "Reply to" |
| Post | Everything else |
| International | Any of the above whose text is mostly not English |

## 2. Checks

Every draft:

- **Still true:** names, versions, and links match what shipped. Check links and flags against the
  docs or the code, as in SKILL.md step 2.
- **Voice:** [voice.md](voice.md) applies in every language: no hype, no engagement bait, no
  competitor names.
- **Length:** `scripts/x_length.py` on each X post. It weights CJK and emoji the way X does.
- **Titled and noted:** a title in the `[<type>] subject — date` or `Reply to @user — topic —
  date` form, and notes that give the sources.
- **Stale:** a reply more than 7 days old, or a post about a release that a newer release already
  covered. Replies lose their point fast; recommend deleting them rather than posting late.

International drafts also need:

- **Same language as the thread.** Reply in the language of the post being answered. An original
  post is in English unless the user asked for a localized one.
- **Written natively, not translated word for word.** Read it as a native developer would: natural
  phrasing, the right register for the platform, and correct punctuation for the script (full-width
  `，。` in Chinese and Japanese).
- **Technical terms left as developers write them.** Product names, APIs, CLI commands, attribute
  names, and code (`span attribute`, `px`, `GitHub issue`) stay in English. Do not translate or
  transliterate them.
- **An English back-translation in the notes.** Add one if it is missing, so a reviewer can check
  what the post says. Mark anything you are unsure of.
- **Facts checked in English first.** Write the claim in English against the source, then check
  that the translation says the same thing and no more.

## 3. Report

Show one table before changing anything: draft title (linked to its `private_url`), bucket,
language, age, what's wrong, and the proposed action: **keep**, **fix** (with the new text, and
an English back-translation for international drafts), or **delete**.

## 4. Apply

Only after the user approves, and only the drafts they approve:

- Fix with `edit_draft`. Run `get_draft` again first; a reviewer's newer edits win. Put the English
  back-translation in `scratchpad_text`.
- Delete with `delete_draft`, one call per draft the user named. Deleting can't be undone, and
  "clean up" alone is not approval to delete a specific draft.
- Never schedule or publish as part of a cleanup.

Finish with what changed: drafts fixed, drafts deleted, and drafts left for a human decision.
