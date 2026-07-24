# Concepts Dedup Inventory

Canonical = the `concepts/` page (owns the "what/why" prose). Twin = the task/how-to
page that should be trimmed to steps + a one-line link back to the canonical page.

| # | Canonical (concepts/) | Twin (trim) | Overlap | Action |
|---|---|---|---|---|
| 1 | tracing/what-are-traces | instrument/set-up-tracing | minor (defs) | Twin: drop "a trace is made of spans…/a project is…" defs; link to canonical |
| 2 | otel-openinference/overview | instrument/set-up-tracing | **significant (1 section)** | Twin: drop OTel/OpenInference overview + "silent failures"; link before setup cards |
| 3 | otel-openinference/instrumentation-approaches | instrument/auto-instrumentation | **substantial (~80%)** | Twin: drop "how auto-instrumentors work" conceptual section; keep helper usage; link |
| 4 | tracing/annotations-concepts | observe/annotations | moderate (2 sections) | Twin: drop annotation-types + annotator-kind tables; link early |
| 5 | evaluators/evaluators | evaluate/llm-evals | moderate (1 section) | Twin: drop "what is an evaluator?"; link in Evaluator Types |
| 6 | evaluators/llm-as-a-judge | evaluate/custom-llm-evaluators | moderate (1 section) | Twin: drop 4-step "how it works"; link before Building Custom |
| 7 | evaluators/building-your-own-evals | evaluate/custom-llm-evaluators | moderate (1.5 sections) | Twin: drop "steps to build" intro; keep code; link |
| 8 | prompts/prompts-concepts | improve/prompts | **significant (1.5 sections)** | Twin: drop "what is a prompt?/templates/versions" defs; link early |
| 9 | datasets-and-experiments | improve/datasets/overview | moderate (1 section) | Twin: drop "what datasets are/why experiments"; link |

**No dedup needed (different angles — leave as-is):**
- evaluators/evaluation-types vs evaluate/client-side-evals (data-types vs SDK patterns)
- prompts/context-engineering-basics vs improve/prompts (distinct disciplines)

All merges: canonical keeps the explanatory prose; twin keeps task steps + gains a
`See [<concept>](…)` link; no page deleted (relocation already redirected the old paths).
