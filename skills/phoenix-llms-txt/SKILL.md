---
name: phoenix-llms-txt
description: Audit and maintain docs/phoenix/llms.txt — the LLM-friendly documentation index for Phoenix.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
---

# Phoenix llms.txt

Maintain `docs/phoenix/llms.txt`, the LLM-friendly index of Phoenix documentation pages.

## What belongs in llms.txt

Include pages that describe how to **use** Phoenix: setup, tracing, evaluation, experiments, prompts, self-hosting, SDK/API reference, and settings.

## Excluded pages

The following pages must **never** appear in `llms.txt`, regardless of whether they exist in the docs tree:

| Page / path | Reason |
|---|---|
| `agent-assisted-setup` | Not useful to LLMs consuming the index; describes using a coding agent to instrument Phoenix, which is meta/circular |
| `integrations/evaluation-integrations/cleanlab` | Third-party eval tool; not core Phoenix functionality |
| `integrations/evaluation-integrations/mlflow` | Third-party eval tool; not core Phoenix functionality |
| `integrations/evaluation-integrations/ragas` | Third-party eval tool; not core Phoenix functionality |
| `integrations/evaluation-integrations/uqlm` | Third-party eval tool; not core Phoenix functionality |
| `legacy/` (entire subtree) | Legacy content; excluded by convention |
| `cookbook/` (entire subtree) | Cookbook examples; excluded by convention |

## Audit procedure

When auditing `llms.txt`:

1. List all `.mdx` files under `docs/phoenix/` excluding `legacy/` and `cookbook/` subtrees.
2. Check each file against the current `llms.txt` entries.
3. For any file not yet in `llms.txt`, check it against the **Excluded pages** table above before adding it.
4. Never add a page from the excluded list even if it is missing from the index.
5. Remove any stale entries that no longer correspond to existing `.mdx` files.
