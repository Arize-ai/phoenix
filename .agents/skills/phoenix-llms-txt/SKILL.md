---
name: phoenix-llms-txt
description: >
  Maintain the Phoenix llms.txt documentation index at docs/phoenix/llms.txt — the
  machine-readable docs map used by AI agents and the `px docs fetch` CLI. Use this
  skill whenever adding, auditing, or reorganizing llms.txt entries. Trigger when the
  user mentions llms.txt, docs index, px docs, or LLM-friendly documentation.
metadata:
  internal: true
---

# Phoenix llms.txt Maintenance

`docs/phoenix/llms.txt` is the machine-readable documentation index for Phoenix, following the [llmstxt.org](https://llmstxt.org/) specification. AI agents, coding assistants, and the `px docs fetch` CLI all consume this file.

## Format

Standard markdown links per the llmstxt.org spec:

```markdown
- [Title](https://arize.com/docs/phoenix/path/to/page): Action-oriented description of what the page teaches
```

Sections use `##` headings, subsections use `###`. Subsections inherit their parent section.

## Coverage rules

**Include as individual entries:**
- All workflow docs (tracing, evaluation, experiments, prompts)
- SDK and API reference pages
- Self-hosting and deployment guides
- Quick start guides (Python and TypeScript)
- Server-side evaluation pages
**Index-level only (one entry, not every sub-page):**
- REST API endpoints — the `api-reference` overview is sufficient
- Legacy evaluation pages
- Cookbooks — link to the cookbook index page only, since individual cookbook pages are typically Colab notebooks that agents cannot parse
- Evaluation integrations — link to the evaluation-integrations index (`https://arize.com/docs/phoenix/integrations/evaluation-integrations`) only; do NOT list individual 3rd-party eval library pages (e.g., Ragas, Cleanlab, UQLM, MLflow). These are thin wrappers around external tools and change frequently.
- Pre-built evaluation metrics — link to the pre-built-metrics index page and the server-evals pre-built-metrics index only; do NOT list each individual metric page (e.g., faithfulness, toxicity, hallucination). The index pages enumerate all available metrics.

**Include as individual entries under Integrations:**
- All LLM provider pages (OpenAI, Anthropic, Bedrock, Google GenAI, etc.) and their tracing/evals sub-pages
- All framework integration pages (LangChain, LlamaIndex, Vercel AI SDK, etc.) and their tracing sub-pages
- All platform integration pages (Dify, Flowise, LangFlow, etc.)
- Developer tools (Coding Agents, MCP Server)

**Exclude — content agents cannot use or does not help them:**
- Agent-assisted setup page — this is for AI coding agents, not for human developers or LLM documentation consumers
- Interactive demos and sandbox links (e.g., Phoenix Demo) — agents cannot interact with live demos
- Colab / Jupyter notebook links (e.g., End-to-End Features Notebook) — agents cannot parse `.ipynb` hosted on Colab
- Cookbook pages that are **only** notebook links without prose documentation — if the page is just a Colab embed, exclude it; if it has substantial written content with code snippets, include it
- Bare external links that have no docs page behind them (e.g., a raw `github.com` URL). Note: docs *about* GitHub (issues, contributing) are fine to keep
- Individual release notes
- Translated pages (`documentation/jp.mdx`, `zh.mdx`)
- Draft or temporary pages
- Duplicate entries — if a page already appears in one section, do not repeat it in another (e.g., don't list "User Guide" in both Overview and Concepts)

**Always include:**
- The OpenAPI spec URL (`https://raw.githubusercontent.com/Arize-ai/phoenix/refs/heads/main/schemas/openapi.json`) in the SDK & API Reference section — this is the most machine-readable resource in the entire docs and critical for agents building API integrations

## Auditing coverage

Every time you add, remove, or audit llms.txt entries you **must** traverse the full docs tree to verify coverage. Follow these steps in order:

### Step 1 — Enumerate all docs pages

```bash
# Build a sorted list of every .mdx page in the docs tree
find docs/phoenix -name "*.mdx" -type f | \
  sed 's|docs/phoenix/||; s|\.mdx$||' | \
  sed 's|^|https://arize.com/docs/phoenix/|' | sort > /tmp/fs_urls.txt
```

### Step 2 — Extract current llms.txt URLs

```bash
grep -oE '\(https://[^)]+\)' docs/phoenix/llms.txt | \
  tr -d '()' | sort > /tmp/llms_urls.txt
```

### Step 3 — Diff for missing and stale entries

```bash
# Pages in docs but NOT in llms.txt (potential gaps)
comm -23 /tmp/fs_urls.txt /tmp/llms_urls.txt > /tmp/missing.txt

# URLs in llms.txt but NOT in docs (potential stale entries)
comm -13 /tmp/fs_urls.txt /tmp/llms_urls.txt > /tmp/stale.txt
```

### Step 4 — Triage each result

For every entry in `/tmp/missing.txt`, open the `.mdx` file and decide:
- **Include** — if it's a real docs page with prose content that an agent could benefit from
- **Skip** — if it matches an exclusion rule above (notebook-only, demo, translated, etc.)
- **Index-only** — if it's a sub-page of a section that should only have one entry (e.g., individual cookbook notebooks, REST API endpoints)

For every entry in `/tmp/stale.txt`:
- Check if the URL is a non-filesystem resource that is still valid (e.g., the OpenAPI spec, external TypeScript SDK docs). These are expected "stale" results — keep them.
- If the `.mdx` file was genuinely deleted, remove the entry from llms.txt.

### Step 5 — Spot-check by section

Walk each `##` section in llms.txt and verify:
1. The section has entries for all major sub-topics in `docs/phoenix/<section>/`
2. No entry is duplicated in another section
3. Descriptions are action-oriented and 10–25 words (see "Writing good descriptions")

Some false positives are expected — directory URLs that resolve via the docs framework's routing are valid even without a corresponding `.mdx` file.

## Section order

1. **Overview** — what Phoenix is
2. **Quick Start** — getting-started guides
3. **Tracing** — capturing execution data
4. **Evaluation** — measuring quality
5. **Datasets & Experiments** — systematic testing
6. **Prompt Engineering** — prompt management and playground
7. **Integrations** — frameworks, providers, platforms (grouped by type)
8. **Settings** — RBAC, API keys, data retention
9. **Concepts** — theoretical foundations
10. **Resources** — FAQs, contribution guide, migration
11. **SDK & API Reference** — Python, TypeScript, REST, OpenInference
12. **Self-Hosting** — deployment and configuration
13. **Phoenix Cloud** — managed service
14. **Cookbooks** — example notebooks

## Writing good titles

Titles are the primary signal an LLM uses to decide whether to fetch a page.

- **Be specific** — titles must be unambiguous when read outside their section context. "Overview" or "Tutorial" alone is meaningless; prefer "Server Evals Overview" or "Tracing Tutorial".
- **No duplicate titles** — every `[Title]` in the file must be unique. If two pages would both be called "Overview", prefix with the topic.

## Writing good descriptions

Descriptions help LLMs decide whether to fetch a page. They should:

- **Be action-oriented** — state what the page teaches you to *do*, not what it's *about*. Use imperative verbs: "Configure…", "Instrument…", "Run…", "Build…". Never use noun-only lists like "Latency, token usage, cost" — instead write "Monitor latency, token usage, and cost across traces".
- **Differentiate from the title** — the description must add information the title does not already convey. If the description just restates the title in different words, it wastes tokens and helps no one. Bad: title "Auto-Optimize", description "Automated prompt optimization". Good: title "Auto-Optimize", description "Use DSPy-style optimizers to improve prompts programmatically".
- **Mention package names** for integration/SDK pages — e.g., "openinference-instrumentation-openai", "@arizeai/phoenix-client".
- **Be 5–20 words** — shorter is better. Cut every word that doesn't help an LLM decide whether to fetch.
- **No filler** — never use "comprehensive", "complete", "learn more about", "information about", "overview of". These words carry zero signal.
- **SDK reference entries** must describe what the package *does*, not just repeat the package name. Bad: "@arizeai/phoenix-evals". Good: "Run LLM and code evaluators in TypeScript".

## Verification

After changes, run the CLI parser tests to confirm the file is well-formed:

```bash
cd js/packages/phoenix-cli && pnpm test -- --grep "docs"
```
