---
name: phoenix-llms-txt
description: >
  Maintain the Phoenix llms.txt documentation index at docs/phoenix/llms.txt — the
  machine-readable docs map used by AI agents and the `px docs fetch` CLI. Use this
  skill whenever adding, auditing, or reorganizing llms.txt entries. Trigger when the
  user mentions llms.txt, docs index, px docs, or LLM-friendly documentation.
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
- All integration pages (each framework/provider gets its own entry)
- SDK and API reference pages
- Self-hosting and deployment guides
- Quick start guides (Python and TypeScript)
- Pre-built evaluation metrics (each metric page)
- Server-side evaluation pages
- Cookbook recipe pages

**Index-level only (one entry, not every sub-page):**
- REST API endpoints — the `api-reference` overview is sufficient
- Legacy evaluation pages

**Exclude:**
- Individual release notes
- Translated pages (`documentation/jp.mdx`, `zh.mdx`)
- Draft or temporary pages

## Auditing coverage

Compare filesystem pages against llms.txt entries to find gaps:

```bash
# Pages in filesystem but missing from llms.txt
find docs/phoenix -name "*.mdx" -type f | \
  sed 's|docs/phoenix/||; s|\.mdx$||' | \
  sed 's|^|https://arize.com/docs/phoenix/|' | sort > /tmp/fs_urls.txt

grep -oE '\(https://arize\.com/docs/phoenix/[^)]+\)' docs/phoenix/llms.txt | \
  tr -d '()' | sort > /tmp/llms_urls.txt

comm -23 /tmp/fs_urls.txt /tmp/llms_urls.txt
```

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

## Writing good descriptions

Descriptions help LLMs decide whether to fetch a page. They should:

- State **what the page teaches you to do**, not just what it's about
- Mention package names, frameworks, or providers for integration/SDK pages
- Be 10–25 words
- Avoid filler like "learn more about" or "information about"

## Verification

After changes, run the CLI parser tests to confirm the file is well-formed:

```bash
cd js/packages/phoenix-cli && pnpm test -- --grep "docs"
```
