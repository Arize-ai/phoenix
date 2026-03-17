---
name: phoenix-llms-txt
description: >
  Maintain the Phoenix llms.txt documentation index at docs/phoenix/llms.txt — the
  machine-readable docs map used by AI agents and the `px docs fetch` CLI. Use this
  skill whenever: adding new docs pages to the index, auditing llms.txt for missing
  or stale entries, regenerating the file from scratch, fixing the docs index after
  adding integration/SDK/evaluation docs, checking coverage of the documentation
  index, making Phoenix docs more accessible to LLMs and coding assistants, updating
  SDK & API reference entries, or working with the llmstxt.org specification. Also
  trigger when the user mentions llms.txt, docs index, px docs, or asks about
  LLM-friendly documentation. This skill is critical for ensuring the docs index
  stays in sync with the actual documentation — use it proactively when docs changes
  are made.
---

# Phoenix llms.txt Maintenance

The `docs/phoenix/llms.txt` file is the **machine-readable documentation index** for Phoenix. It serves two purposes:

1. **LLM navigation** — AI agents and coding assistants use it to discover and understand Phoenix documentation (per the [llmstxt.org](https://llmstxt.org/) specification)
2. **CLI docs fetcher** — the `px docs fetch` command parses this file to download documentation for offline use

Because the CLI parser depends on a specific entry format, changes to llms.txt must preserve compatibility. This skill explains the format, how to discover new docs, and how to keep the index accurate.

---

## File location

```
docs/phoenix/llms.txt
```

Served at: `https://arize.com/docs/phoenix/llms.txt`

---

## Format specification

The file follows the [llmstxt.org](https://llmstxt.org/) spirit but uses a **custom entry format** required by the Phoenix CLI parser (`px docs fetch`).

### Structure

```markdown
# Phoenix Documentation Index

This file provides an overview of the Phoenix documentation structure...

## Section Name

Description paragraph explaining what this section covers.

### Optional Subsection

- Entry Title: `https://arize.com/docs/phoenix/path/to/page` - Concise description of what this page covers
```

### Entry format (critical)

Each documentation entry **must** use this exact format:

```
- Title: `url` - Description
```

The CLI parser uses this regex: `^-\s+(.+?):\s+\`(https?:\/\/[^`]+)\`(?:\s+-\s+(.*))?$`

Breaking it down:
- `- ` — list item prefix
- `Title` — human-readable page name (no colons allowed in the title itself)
- `: ` — separator between title and URL
- `` `url` `` — full URL wrapped in backticks
- ` - Description` — optional description after ` - ` separator

**Format pitfalls to avoid:**
- Do NOT use standard markdown links like `[Title](url)` — the CLI parser won't match them
- Do NOT add sub-entries or indented lines under an entry — the parser only reads top-level list items
- Do NOT include external URLs (like ReadTheDocs or GitHub Pages links) as entries — the CLI appends `.md` to fetch content, which breaks for external domains. Mention external API reference links in section description paragraphs instead
- Do NOT put colons in entry titles — the regex uses the first `: ` as the title/URL separator

**Why not standard markdown links?** The `px docs fetch` command and its test suite depend on this format. If you want to migrate to `[Title](url): Description` (the llmstxt.org standard), you must also update the parser in `js/packages/phoenix-cli/src/commands/docs.ts` and the tests in `js/packages/phoenix-cli/test/docs.test.ts`.

### Section hierarchy

- `## Section` — top-level sections (these map to CLI workflow categories)
- `### Subsection` — subsections inherit their parent `##` section for filtering purposes
- The CLI's `--workflow` flag filters by `##` section names (lowercased)

### Workflow mapping

The CLI maps workflow names to section headings:

| CLI workflow | Section heading |
|---|---|
| `tracing` | Tracing |
| `evaluation` | Evaluation |
| `datasets` | Datasets & Experiments |
| `prompts` | Prompt Engineering |
| `integrations` | Integrations |
| `sdk` | SDK & API Reference |
| `self-hosting` | Self-Hosting |

New top-level sections that should be CLI-fetchable need a corresponding entry in the `WORKFLOW_SECTION_MAP` in `js/packages/phoenix-cli/src/commands/docs.ts`.

### Handling duplicate entries

Some pages appear in multiple sections for cross-referencing (e.g., `user-guide` in both Overview and Concepts). This is acceptable for discoverability but be aware the CLI will fetch the same page twice. Avoid adding new duplicates unless there's a strong navigation reason.

---

## How to audit for completeness

When updating llms.txt, systematically check for documentation pages that exist in the filesystem but are missing from the index.

### Step 1: Enumerate all docs pages

```bash
find docs/phoenix -name "*.mdx" -type f | sort
```

### Step 2: Extract all URLs currently in llms.txt

```bash
# Works on both macOS and Linux
grep -oE '`https://arize\.com/docs/phoenix/[^`]+`' docs/phoenix/llms.txt | tr -d '`' | sort
```

### Step 3: Compare

Convert filesystem paths to expected URLs and diff:

```bash
# Filesystem pages → expected URLs
find docs/phoenix -name "*.mdx" -type f | \
  sed 's|docs/phoenix/||; s|\.mdx$||' | \
  sed 's|^|https://arize.com/docs/phoenix/|' | sort > /tmp/fs_urls.txt

# URLs currently in llms.txt
grep -oE '`https://arize\.com/docs/phoenix/[^`]+`' docs/phoenix/llms.txt | \
  tr -d '`' | sort > /tmp/llms_urls.txt

# Pages in filesystem but not in llms.txt
comm -23 /tmp/fs_urls.txt /tmp/llms_urls.txt
```

### Step 4: Check for stale entries

URLs in llms.txt that don't correspond to a filesystem page may have been moved or deleted:

```bash
comm -13 /tmp/fs_urls.txt /tmp/llms_urls.txt
```

**Watch out for false positives:** Some paths exist as both a `.mdx` file and a directory (e.g., `sdk-api-reference.mdx` plus `sdk-api-reference/`). The diff will show these as stale because the URL maps to the directory path, not the `.mdx` file. Verify manually before removing — if the `.mdx` file exists at the path, the entry is valid.

Similarly, some entries point to directory URLs (like `cookbook/agent-workflow-patterns`) that have no `.mdx` file but resolve on the live site via the docs framework's routing. These are valid if the live URL works.

### Step 5: Check for duplicates

```bash
grep -oE '`https://arize\.com/docs/phoenix/[^`]+`' docs/phoenix/llms.txt | \
  tr -d '`' | sort | uniq -d
```

### Step 6: Validate links resolve

Every URL in llms.txt should resolve when `.md` is appended (that's how the CLI fetches content):

```bash
# Quick spot-check a few URLs
grep -oE '`https://arize\.com/docs/phoenix/[^`]+`' docs/phoenix/llms.txt | \
  tr -d '`' | head -5 | while read url; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "${url}.md")
    echo "$status $url"
  done
```

---

## How to discover new documentation

When docs are added to the project, they need to be reflected in llms.txt. Here's where to look:

### Sources of new documentation

1. **New `.mdx` files** in `docs/phoenix/` — the primary source. Run the audit diff above.

2. **Sitemap** — `docs/phoenix/sitemap.xml` lists all published pages. Cross-reference with llms.txt entries.

3. **Git history** — check recent additions:
   ```bash
   git log --diff-filter=A --name-only --pretty=format: -- 'docs/phoenix/**/*.mdx' | head -20
   ```

4. **Integration docs** — these are the most commonly missed pages:
   - `docs/phoenix/integrations/python/` — Python framework integrations (~40 pages)
   - `docs/phoenix/integrations/typescript/` — TypeScript framework integrations (~13 pages)
   - `docs/phoenix/integrations/java/` — Java framework integrations (~6 pages)
   - `docs/phoenix/integrations/llm-providers/` — LLM provider integrations (~33 pages)
   - `docs/phoenix/integrations/platforms/` — Platform integrations (~8 pages)
   - `docs/phoenix/integrations/evaluation-integrations/` — Eval library integrations (~4 pages)

5. **Evaluation docs** — especially `evaluation/server-evals/` (server-side evaluations) and `evaluation/pre-built-metrics/` (individual metric pages), which are frequently added.

6. **Cookbook entries** — `docs/phoenix/cookbook/` for example notebooks.

### What to include vs. exclude

**Always include (each page gets its own entry):**
- All workflow documentation (tracing, evaluation, experiments, prompts)
- All individual integration pages (each framework/provider overview page)
- SDK and API reference pages
- Self-hosting and deployment guides
- Quick start guides (both Python and TypeScript variants)
- Concept explainers
- Individual pre-built evaluation metric pages
- Server-side evaluation pages
- Individual cookbook recipe pages

**Include at index level only (one entry for the section, not each sub-page):**
- REST API individual endpoint pages — the `api-reference` overview page is sufficient
- Legacy evaluation pages under `evaluation/legacy/` — link to the section if needed

**Exclude entirely:**
- Individual release notes (the `release-notes` overview page is enough)
- Translated documentation (`docs/phoenix/documentation/jp.mdx`, `zh.mdx`)
- Temporary or draft pages

---

## Section organization guide

The llms.txt follows a deliberate information architecture. When adding entries, place them in the correct section:

### Section order and purpose

1. **Overview** — top-level pages that explain what Phoenix is and how to think about it
2. **Quick Start** — hands-on getting-started guides for each core feature (include both Python and TypeScript variants)
3. **Tracing** — everything about capturing execution data from AI applications, including sub-pages for setup, metadata, annotations, import/export, cost tracking, and advanced configuration
4. **Evaluation** — measuring quality with LLM judges, code evaluators, pre-built metrics, server-side evaluations
5. **Datasets & Experiments** — systematic testing and comparison workflows
6. **Prompt Engineering** — prompt management, playground, versioning, optimization
7. **Integrations** — framework, provider, and platform integrations (grouped by type). Each integration should have its own entry, not just a summary paragraph
8. **Settings** — RBAC, API keys, data retention, custom AI providers
9. **Concepts** — theoretical foundations grouped by domain
10. **Resources** — FAQs (including individual FAQ pages), contribution guide, migration, external links
11. **SDK & API Reference** — programmatic interfaces (Python, TypeScript, REST, OpenInference). Include external API reference links (ReadTheDocs, GitHub Pages) in section description paragraphs, not as entries
12. **Self-Hosting** — deployment, configuration, security, upgrade
13. **Phoenix Cloud** — managed service information
14. **Cookbooks** — practical example notebooks and guides (include individual recipe pages)

### Writing good descriptions

Descriptions should help an LLM decide whether to fetch the page. Good descriptions:

- State **what the page teaches you to do**, not just what it's about
- Mention the package name, framework, or provider for integration/SDK pages
- Include key terms an LLM might search for
- Are 10-25 words
- Avoid vague phrases like "learn more about" or "information about"

**Good:** `Configure Phoenix to receive traces via OpenTelemetry, set up projects and sessions, and configure instrumentation`

**Good:** `Python client library (arize-phoenix-client) for managing datasets, experiments, traces, prompts, and annotations via REST API`

**Bad:** `Information about setting up tracing`

**Bad:** `Python client library reference`

---

## Programmatic API and SDK links

These entries are critical for agents that need to interact with Phoenix programmatically. Make sure they are always present and accurate.

### REST API

The REST API section should include the overview and reference pages. Individual endpoint pages (67+) should NOT be listed — the api-reference page serves as the index. Mention that the OpenAPI spec is at `schemas/openapi.json`.

```
- REST API Overview: `https://arize.com/docs/phoenix/sdk-api-reference/rest-api/overview` - REST API setup, authentication with bearer tokens, and making your first request
- API Reference: `https://arize.com/docs/phoenix/sdk-api-reference/rest-api/api-reference` - Complete REST API endpoint reference for annotation configs, annotations, datasets, experiments, spans, traces, prompts, projects, sessions, and users
```

### Python SDK packages

| Package | PyPI name | Purpose |
|---|---|---|
| phoenix-client | `arize-phoenix-client` | REST API client for datasets, experiments, traces, prompts, feedback |
| phoenix-evals | `arize-phoenix-evals` | Evaluation library with pre-built and custom evaluators |
| phoenix-otel | `arize-phoenix-otel` | OpenTelemetry setup and auto-instrumentation |

External API references (mention in section description, not as entries):
- Python ReadTheDocs: `https://arize-phoenix.readthedocs.io/projects/client/`, `/otel/`, `/evals/`

### TypeScript SDK packages

| Package | npm name | Purpose |
|---|---|---|
| @arizeai/phoenix-client | `@arizeai/phoenix-client` | REST API client with prompt SDK-format conversion |
| @arizeai/phoenix-evals | `@arizeai/phoenix-evals` | Evaluation library with custom classifiers |
| @arizeai/phoenix-otel | `@arizeai/phoenix-otel` | OpenTelemetry wrapper for Node.js |
| @arizeai/phoenix-cli | `@arizeai/phoenix-cli` | CLI for traces, datasets, experiments, prompts, GraphQL |
| @arizeai/phoenix-mcp | `@arizeai/phoenix-mcp` | MCP server for AI assistants (Claude, Cursor) |
| @arizeai/openinference-core | `@arizeai/openinference-core` | OpenInference semantic conventions and tracing helpers |

External API references (mention in section description, not as entries):
- TypeScript typedoc: `https://arize-ai.github.io/phoenix/modules.html`
- OpenInference JS: `https://arize-ai.github.io/openinference/js/`

### OpenInference

OpenInference is the instrumentation specification that Phoenix uses. SDKs exist for Python, TypeScript, and Java:

- Python: `openinference-instrumentation-{name}` packages
- TypeScript: `@arizeai/openinference-*` packages
- Java: `openinference-instrumentation-*` Maven artifacts
- Spec repo: https://github.com/Arize-ai/openinference

---

## Verifying changes

After modifying llms.txt, verify the CLI can still parse it:

```bash
# Run the CLI parser tests
cd js/packages/phoenix-cli && pnpm test -- --grep "parseLlmsTxt"
```

The test fixtures use a symlink to the real llms.txt, so test failures after editing indicate a format problem.

You can also do a dry run of the CLI fetcher to validate all entries parse correctly:

```bash
npx px docs --dry-run --workflow all
```

---

## Updating checklist

When updating llms.txt:

- [ ] Run the filesystem audit (Steps 1-5 above) to find missing, stale, and duplicate entries
- [ ] Add new entries in the correct section with the exact format: `- Title: \`url\` - Description`
- [ ] Write descriptive descriptions (10-25 words, action-oriented, include package/framework names)
- [ ] Verify no colons in entry titles (breaks the parser regex)
- [ ] Only use `https://arize.com/docs/phoenix/` URLs as entries — external links go in description paragraphs
- [ ] Check that entries are not duplicated across sections (unless intentional cross-reference)
- [ ] Run `cd js/packages/phoenix-cli && pnpm test -- --grep "docs"` to verify the parser still works
- [ ] Spot-check a few URLs to make sure they resolve (append `.md` and curl)
