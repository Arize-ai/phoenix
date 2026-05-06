---
name: phoenix-release-notes
description: >
  Create Phoenix release documentation grounded in actual code changes. Use this skill whenever the
  user asks to write release notes, document a release, update release documentation, or mentions
  undocumented releases. Also trigger when the user wants to update GitHub release descriptions,
  add entries to the release notes page, or asks what changed in a recent Phoenix version.
metadata:
  internal: true
---

# Release Notes

Create and publish release documentation for Phoenix. This skill walks through a structured
workflow: identify undocumented releases, analyze commits by reading the actual code, draft MDX
files, and update all the documentation touchpoints.

## Tone and Style

Write for a developer who uses Phoenix daily. The voice is technical, friendly, and informative
without being verbose.

- **Active voice, present tense**: "Phoenix now provides..." not "A new feature has been added..."
- **Lead with what the user can do**, not what changed internally. The reader cares about
  capabilities, not implementation details.
- **Concise**: 1-3 sentence intro, then bullet points for details. If a bullet can say it, don't
  write a paragraph.
- **Code examples are mandatory** when a feature has a programmatic API. Show working,
  copy-pasteable snippets. Show both Python and TypeScript when both SDKs are affected.
- **Version requirements in bold**: `**Available in arize-phoenix X.Y.Z+**`
- **No PR numbers, commit hashes, or install commands** in the release notes themselves.

## Packages to Track

| Package | Tag pattern |
|---------|------------|
| arize-phoenix (server) | `arize-phoenix-v*` |
| arize-phoenix-client (Python SDK) | `arize-phoenix-client-v*` |
| arize-phoenix-evals | `arize-phoenix-evals-v*` |
| arize-phoenix-otel | `arize-phoenix-otel-v*` |
| @arizeai/phoenix-client (TS SDK) | Check `js/packages/phoenix-client/package.json` |
| @arizeai/phoenix-cli (TS CLI) | Check `js/packages/phoenix-cli/package.json` |
| @arizeai/phoenix-evals (TS evals) | Check `js/packages/phoenix-evals/package.json` |
| @arizeai/phoenix-mcp (TS MCP) | Check `js/packages/phoenix-mcp/package.json` |
| @arizeai/phoenix-otel (TS OTel) | Check `js/packages/phoenix-otel/package.json` |

## Step 1: Identify Undocumented Releases

Compare GitHub releases against existing documentation to find the gap.

```bash
# Recent GitHub releases
gh release list --repo Arize-ai/phoenix --limit 30

# Existing release note files
ls docs/phoenix/release-notes/*/

# Dates already covered in the aggregate file
grep 'Update label=' docs/phoenix/release-notes.mdx
```

Each `<Update>` entry in the aggregate file covers a date. Multiple versions released on the same
date get combined into one entry. Identify releases that have no corresponding coverage.

## Step 2: Analyze Commits

For each undocumented release, examine the actual changes — not just the commit messages.

### Get the changelog

```bash
gh release view <TAG> --repo Arize-ai/phoenix --json body --jq '.body'
```

The release body from release-please lists conventional commits with PR links. Use this as a
starting index, then dig deeper.

### Read the actual code

For each `feat()` and significant `fix()` commit, read the changed files to understand what the
feature actually does. Commit messages are often terse — the code tells the real story. Key places:

- **Server REST endpoints**: `src/phoenix/server/api/routers/v1/`
- **Python client SDK**: `packages/phoenix-client/src/phoenix/client/`
- **TypeScript client SDK**: `js/packages/phoenix-client/src/`
- **UI features**: `app/src/pages/`
- **Evaluators**: `packages/phoenix-evals/src/phoenix/evals/`
- **CLI**: `packages/phoenix-client/src/phoenix/client/cli/`
- **Models/providers**: playground and model configuration code

### Classify each change

**INCLUDE** — things users interact with directly:
- New API endpoints or SDK methods
- New UI features or pages
- New model or provider support
- Breaking changes to public APIs
- New CLI commands or flags
- New evaluator types or capabilities
- Performance improvements with visible user impact

**EXCLUDE** — internal housekeeping:
- Dependency bumps (`chore(deps):`, `fix(deps):`)
- Internal refactoring with no API surface change
- Test additions or fixes
- CI/CD and build changes
- Code style or formatting changes
- Internal tooling, skills, or dev workflows
- Reverts that cancel out a feature within the same release

**EXCLUDE — beta features (hard rule):**
- **PXI agent** — anything under the `phoenix-pxi` namespace, the PXI runtime, or PXI tool
  wiring. PXI is still in beta and is not announced in release notes.
- **Phoenix AI Assistant** — the in-app assistant widget, its settings page
  (`Settings → Agents`), system prompt customization, enable/disable toggle, and response
  feedback (thumbs up/down, copy, open-trace). The assistant is still in beta.

If a commit, PR, or feature touches PXI or the assistant, skip it entirely — do not mention it
in individual MDX files, the aggregate `release-notes.mdx`, the year overview, or `docs.json`
navigation. This exclusion stands even if the change is user-visible. Revisit only when the
user explicitly says these features are GA.

If a release contains only excluded changes, skip it — no release note needed.

### Group related commits

Multiple commits often implement a single feature across server + client + UI. A REST endpoint
commit, a Python client wrapper, and a TypeScript client wrapper should become one release note
entry that mentions all relevant package versions — not three separate entries.

## Step 3: Draft Individual MDX Files

### File location

```
docs/phoenix/release-notes/{MM-YYYY}/{MM-DD-YYYY}-{slug-title}.mdx
```

Create the month directory if it doesn't exist: `mkdir -p docs/phoenix/release-notes/MM-YYYY`

### Frontmatter title rules (apply to BOTH formats)

Every release note MDX file — single-topic or multi-topic — **must** have a descriptive,
date-prefixed `title` in its frontmatter. The title appears in browser tabs, the sidebar,
and search results, so a generic `"Release Notes"` makes the page indistinguishable from
the index page.

Required format: `title: "MM.DD.YYYY: Descriptive Title"`

- ✅ `title: "04.29.2026: Dataset Upsert"`
- ✅ `title: "05.05.2026: REST API Updates"`
- ✅ `title: "04.30.2026: Annotation Enhancements"`
- ❌ `title: "Release Notes"` — never use this; it collides with the index page
- ❌ `title: "Dataset Upsert"` — missing the date prefix
- ❌ `title: "04.29.2026 Dataset Upsert"` — missing the colon separator

For multi-topic files, the title summarizes the theme of the bundle (e.g.
`"04.30.2026: Annotation Enhancements"`), not any single feature inside it.

### Format A: Single-topic file

Use when one feature is significant enough to warrant its own page.

```mdx
---
title: "MM.DD.YYYY: Feature Title"
description: "One-sentence description of the feature."
---

Introductory paragraph explaining what users can now do.

## Section Heading

- **Bold lead** describing a capability
- **Another point** with technical detail

```python
# Working Python example
```

```ts
// Working TypeScript example
```

<CardGroup cols={2}>
  <Card title="Related Doc" icon="book" href="/docs/phoenix/path">
    Brief description
  </Card>
</CardGroup>
```

### Format B: Multi-topic file

Use when several features from a date range are combined into one file. The frontmatter
`title` still follows the `MM.DD.YYYY: Theme` rule (see "Frontmatter title rules" above) —
**never** use `"Release Notes"`.

```mdx
---
title: "MM.DD.YYYY: Theme Title"
---

# Feature Title One

Month DD, YYYY

**Available in arize-phoenix X.Y.Z+**

Description paragraph.

- **Bullet** describing capability

```python
# code example
```

# Feature Title Two

Month DD, YYYY

**Available in package-name X.Y.Z+**

Description paragraph.
```

### Version line format

Match the version line to which packages are involved:

```
**Available in arize-phoenix 13.14.0+**
**Available in arize-phoenix-client 2.0.0+ (Python) and @arizeai/phoenix-client 6.4.0+ (TypeScript)**
**Available in arize-phoenix 13.13.0+ (server), arize-phoenix-client 1.31.0+ (Python)**
**Breaking change in arize-phoenix-client 2.0.0**
```

### Choosing between formats

| Situation | Format |
|-----------|--------|
| Single major feature on a date | Format A |
| Multiple features on a date range | Format B |
| Feature spans server + client | One entry, mention all package versions |
| Breaking change | Prefix title with "Breaking Change:" |
| TS-only or Python-only feature | Show only the relevant language |
| Video/screenshot available | Use `<video>` or `<Frame>` in the individual file |

## Step 4: Update the Aggregate File

File: `docs/phoenix/release-notes.mdx`

Insert each new `<Update>` block at the correct chronological position relative to **all**
existing blocks — not as a contiguous group at the top. Each block is a condensed summary
linking to the individual file.

```mdx
<Update label="MM.DD.YYYY">
## [MM.DD.YYYY: Feature Title](/docs/phoenix/release-notes/MM-YYYY/MM-DD-YYYY-slug-title)
**Available in ...**

Brief 1-3 sentence summary. Action-oriented.

- **Key capability** with brief description
- **Another capability** with brief description
</Update>
```

Rules:
- `label` uses dot separators: `MM.DD.YYYY`
- Link path has no `.mdx` extension
- Keep each block to 5-10 lines
- If one MDX file covers multiple features, create separate `<Update>` blocks per feature date

### Reverse-chronological insertion (do not skip this)

The aggregate file is sorted strictly newest-first by date. Existing entries are already
ordered, so inserting a batch of new entries is a **merge**, not an append.

**Wrong** — stacking all new entries at the top as a contiguous block:

```
[NEW 05.05] [NEW 05.05] [NEW 04.30] [NEW 04.30] [NEW 04.29] [old 05.01] [old 04.28] ...
                                                              ^^^^^^^^^^
                                          older date appears AFTER newer dates — broken
```

**Right** — interleave each new entry with existing entries by date:

```
[NEW 05.05] [NEW 05.05] [old 05.01] [NEW 04.30] [NEW 04.30] [NEW 04.29] [old 04.28] ...
```

Procedure when adding multiple entries:

1. List every date you are adding.
2. Read the existing labels in order: `grep -n 'Update label=' docs/phoenix/release-notes.mdx`
3. For **each** new entry, find the first existing label whose date is strictly older, and
   insert the new block immediately before it. Same-date ties stay together.
4. After inserting, re-run the grep and read the dates top-to-bottom — they must be
   monotonically non-increasing. If any older date appears above a newer one, fix it
   before moving on.

## Step 5: Update the Year Overview

File: `docs/phoenix/release-notes/YYYY.mdx` (e.g., `2026.mdx`)

Add a `<Card>` entry at the top of the `<CardGroup>`:

```mdx
<Card href="/docs/phoenix/release-notes/MM-YYYY/MM-DD-YYYY-slug-title" arrow="true" title="MM.DD.YYYY" icon="calendar" description="Brief description of the feature"/>
```

## Step 6: Update Navigation

File: `docs.json` (repository root)

Find the "Release Notes" tab. Add new page paths to the appropriate monthly group.

### If the month group exists

Add the page path to the existing group's `pages` array (newest first):

```json
{
  "group": "MM.YYYY",
  "pages": [
    "docs/phoenix/release-notes/MM-YYYY/MM-DD-YYYY-new-page",
    "docs/phoenix/release-notes/MM-YYYY/existing-page"
  ]
}
```

### If the month group doesn't exist

Create a new group object in the correct chronological position (newest month first, after the
aggregate page entry):

```json
{
  "group": "MM.YYYY",
  "pages": [
    "docs/phoenix/release-notes/MM-YYYY/MM-DD-YYYY-slug-title"
  ]
}
```

Page paths: forward slashes, no leading slash, no `.mdx` extension.

## Step 7: Update GitHub Release Description (Optional)

Only when explicitly requested. The default release-please changelog is acceptable.

**You MUST preserve the existing release body.** First fetch it, then prepend a highlights section:

```bash
# 1. Fetch the existing release body
EXISTING_BODY=$(gh release view <TAG> --repo Arize-ai/phoenix --json body --jq '.body')

# 2. Prepend highlights and wrap the original body in a details block
gh release edit <TAG> --repo Arize-ai/phoenix --notes "$(cat <<EOF
## Highlights

### Feature Title
Description with user-facing framing.

See the [release notes](https://docs.arize.com/phoenix/release-notes/MM-YYYY/MM-DD-YYYY-slug) for details.

---
<details>
<summary>Conventional commits</summary>

$EXISTING_BODY
</details>
EOF
)"
```

## Step 8: Verify

Before considering the work complete, check every touchpoint:

1. **Files exist**: All new MDX files are at expected paths
2. **Frontmatter valid**: Each file has YAML frontmatter with at least `title`
3. **Aggregate links resolve**: Every `/docs/phoenix/release-notes/...` path in the aggregate
   file matches an actual file
4. **Year overview updated**: New cards point to correct paths
5. **Navigation complete**: `docs.json` contains all new page paths with no dangling references
6. **Reverse-chronological order**: Entries in aggregate file, year overview, and docs.json are
   newest-first
7. **Code examples valid**: Snippets are syntactically correct with no placeholder values
8. **No internal changes leaked**: Double-check that no dependency bumps, refactors, or
   test-only changes made it into user-facing notes

### Quick validation

```bash
# Verify aggregate links point to real files
grep -oP '(?<=\()/docs/phoenix/release-notes/[^)]+' docs/phoenix/release-notes.mdx | while read path; do
  file="${path}.mdx"
  [ -f "$file" ] || echo "MISSING: $file"
done

# Catch any new file that still has the generic "Release Notes" title
grep -l '^title: "Release Notes"$' docs/phoenix/release-notes/**/*.mdx 2>/dev/null \
  && echo "FAIL: file(s) above use the generic 'Release Notes' title — must be 'MM.DD.YYYY: ...'" \
  || echo "OK: all per-date files have descriptive titles"

# Confirm reverse-chronological order in the aggregate file
grep -nP 'Update label="[\d.]+' docs/phoenix/release-notes.mdx \
  | awk -F'[:."]' '{ printf "%s %s%s%s\n", $1, $5, $3, $4 }' \
  | awk 'NR>1 && $2>prev { print "OUT OF ORDER at release-notes.mdx:" $1 " — " $2 " appears above " prev; bad=1 } { prev=$2 } END { if (!bad) print "OK: reverse-chronological order intact" }'
```

## Decision Quick Reference

| Question | Answer |
|----------|--------|
| Release has only dep bumps? | Skip — no release note |
| Feature reverted in same release? | Exclude both feat and revert |
| Month directory missing? | Create it with `mkdir -p` |
| Month nav group missing in docs.json? | Add new group object |
| Feature spans multiple packages? | One entry, list all versions |
| Not sure if user-facing? | Read the code — if a user can't see or call it, exclude it |

## Pre-Submit Checklist

Before opening a PR or considering the work done, walk through every item below. Do not skip any.

### Steps completed

- [ ] **Step 1**: Identified all undocumented releases
- [ ] **Step 2**: Analyzed commits by reading the actual changed code, not just commit messages
- [ ] **Step 3**: Drafted individual MDX files with correct frontmatter and file paths
- [ ] **Step 4**: Updated the aggregate file (`release-notes.mdx`) with `<Update>` blocks
- [ ] **Step 5**: Updated the year overview (`YYYY.mdx`) with `<Card>` entries
- [ ] **Step 6**: Updated `docs.json` navigation with all new page paths
- [ ] **Step 7**: (Only if requested) Updated GitHub release descriptions, preserving existing body
- [ ] **Step 8**: Ran verification — all links resolve, order is correct, no dangling references

### Technical writing review

Review every MDX file you created as an expert technical writer:

- [ ] **Lead with user value**: Every section opens with what the user can now do, not what changed internally
- [ ] **Active voice, present tense**: No passive constructions like "has been added" or "was implemented"
- [ ] **Concise**: No filler, no preamble. If a bullet can say it, don't write a paragraph
- [ ] **Consistent terminology**: Use the same term for the same concept throughout — don't alternate between synonyms
- [ ] **Scannable structure**: Headings, bold leads on bullets, code blocks. A reader skimming should get the gist
- [ ] **No jargon leaks**: No internal class names, module paths, or implementation details unless they are part of the public API
- [ ] **Version lines are accurate**: Each entry states the correct package names and minimum versions

### Code snippet validation

Every code example must be grounded in real code — no hallucinated APIs:

- [ ] **Verified against source**: For each snippet, you read the actual implementation to confirm the function signatures, parameter names, return types, and class names are correct
- [ ] **Import paths are real**: Any `import` or `from` statements use actual module paths from the codebase
- [ ] **Runnable as-is**: Snippets are syntactically valid and copy-pasteable — no placeholder values like `YOUR_KEY` or `...` unless explicitly documenting a user-provided value
- [ ] **Both languages when applicable**: If a feature has both Python and TypeScript SDKs, both examples are included and verified

### Formatting and linting

- [ ] **Valid MDX**: Each file has YAML frontmatter with at least `title`, all JSX components are properly closed
- [ ] **Frontmatter title is date-prefixed**: `title: "MM.DD.YYYY: Descriptive Title"` — never `"Release Notes"` (which is reserved for the index page) and never missing the date prefix
- [ ] **Aggregate order is reverse-chronological**: After inserting new entries, read the labels top-to-bottom in `release-notes.mdx`. Dates must be monotonically non-increasing — no older date ever appears above a newer one. New entries must be **interleaved** with existing ones by date, not stacked as a contiguous block at the top.
- [ ] **No trailing whitespace or extra blank lines**
- [ ] **Fenced code blocks have language tags**: Every ` ``` ` block specifies `python`, `typescript`, `bash`, `json`, etc.
- [ ] **Links have no `.mdx` extension**: All internal doc links use extensionless paths
- [ ] **Consistent date formats**: `MM.DD.YYYY` in labels and headings, `MM-DD-YYYY` in file paths
