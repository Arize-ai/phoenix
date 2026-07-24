# Span header permutations

The `Detail panel/Span header` Storybook page covers OK, error, and unset status; LLM, embedding, and unknown kinds; short, long unbroken, and Unicode names; the complete production action set; and the full metadata matrix. When changing the header, consider these additional dimensions:

- Remaining span kinds: chain, retriever, agent, tool, reranker, evaluator, guardrail, and prompt.
- Zero-valued latency, token count, and cost.
- Partial action sets if production gains conditional actions beyond Playground.
- Width: wide detail page, narrow drawer, and a width where metadata wraps to another line.
- Time formatting: each supported user time-zone and 12/24-hour preference.
- Identifiers: short development IDs and full production span IDs.
