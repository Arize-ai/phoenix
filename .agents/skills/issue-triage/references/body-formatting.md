# Body formatting

How to restructure an unreadable issue body (stage 6) without changing what the
reporter said.

## The one rule

**The reporter's words stay verbatim.** Reorganise, label and quote them; never
paraphrase, summarise, correct or delete them. Their text is the evidence for
the bug. If restructuring would require rewording, stop and leave the body
alone.

Everything you add is clearly yours, inside the triage block below. A reader
must always be able to tell reported text from triage text.

## Target shapes

Follow the repo's issue forms, which are the house shape:

**Bug** — `.github/ISSUE_TEMPLATE/bug.yml`

```markdown
### Where do you use Phoenix
<!-- Self-hosted | Phoenix Cloud -->

### What version of Phoenix are you using?

### What happened?

### Additional information
```

**Enhancement** — `.github/ISSUE_TEMPLATE/feature_request.yml`

```markdown
### Is your feature request related to a problem? Please describe.

### Describe the solution you'd like
```

Include only the headings you can actually fill from the reporter's text. An
empty heading is worse than a missing one — it looks answered.

## Recipe

1. Read the current body: `gh issue view <n> --repo Arize-ai/phoenix --json body --jq .body`
2. Decide whether it needs work at all. Skip if it is already scannable.
3. Map each piece of existing text to a heading, moving it **unchanged**. Keep
   code blocks, stack traces, logs and images exactly as they are, fenced.
4. Text that fits no heading goes last under `### Additional information`
   (bug) or at the end (enhancement). Never drop it.
5. Put anything you contribute — missing-info requests, the component or
   complexity rationale, pointers — inside the triage block.
6. Write the result to a file and apply it:
   `gh issue edit <n> --repo Arize-ai/phoenix --body-file <file>`

Compose in a file rather than inline: bodies contain backticks, quotes and
newlines that do not survive shell quoting.

## The triage block

Append your own content in exactly this form, at the end of the body:

```markdown
<!-- triage:begin -->
---
**Triage notes**

- Missing: expected behavior — what should `px trace` print on a bad id?
<!-- triage:end -->
```

The markers make stage 6 idempotent, which matters because triage runs
repeatedly over the same backlog:

- If `<!-- triage:begin -->` is already present, **replace the whole block**
  between the markers. Never append a second one.
- Everything outside the markers is reporter text or a previous restructure —
  leave the reporter's portions untouched.
- Never put triage content outside the markers, and never put reporter text
  inside them.

Keep the block short: a few bullets. Investigation findings belong in a stage 5
comment, not in the body.

## When not to touch a body

- It is already clear, even if terse.
- Restructuring would need rewording to make sense.
- The body is a single coherent paragraph or a filled-in template already.
- The only problem is missing information — add `needs information` (stage 2)
  and note the gap in the triage block; do not invent structure around nothing.
- The issue is a question or discussion rather than a work item.
