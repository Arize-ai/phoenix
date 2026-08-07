# MCP surface benchmark — findings

Generated from `runs-20260720T071302Z-rejudged.jsonl` (3 repeats per cell, GPT-5 cross-judged).
Regenerate with `analyze.py`; do not hand-edit.

## Headline

| Metric | code_mode | phoenix_mcp | ratio |
|---|---|---|---|
| Billed tokens, median question | 33,240 | 69,630 | 2.09x |
| Peak context, median question | 6,874 | 52,982 | 7.71x |
| Peak context, worst request | 19,510 | 451,689 | 23.2x |
| Correct (cross-judged) | 22/24 | 17/24 | |
| Runs needing self-correction | 18/24 | 0/24 | |
| Round trips, per pass | 69 | 17 | |

## Variance across repeats

| Arm | Median spread | Worst |
|---|---|---|
| code_mode | 22% | 122% |
| phoenix_mcp | 2% | 19% |

## Per question

| Question | code tokens | npm tokens | ratio | code correct | npm correct |
|---|---|---|---|---|---|
| `cross_project_health` | 72,223 | 470,484 | 6.51x | 3/3 | 1/3 |
| `datasets_with_experiments` | 23,996 | 69,496 | 2.90x | 1/3 | 2/3 |
| `error_themes` | 61,930 | 215,264 | 3.48x | 3/3 | 3/3 |
| `latency_by_model` | 63,427 | 69,167 | 1.09x | 3/3 | 2/3 |
| `llm_latency_percentiles` | 39,879 | 69,764 | 1.75x | 3/3 | 3/3 |
| `project_count` | 7,806 | 17,464 | 2.24x | 3/3 | 0/3 |
| `slowest_span` | 24,895 | 64,191 | 2.58x | 3/3 | 3/3 |
| `span_kind_mix` | 26,600 | 70,631 | 2.66x | 3/3 | 3/3 |

## Caveats

- Two arms only. The `tool_groups` arm (progressive disclosure without the sandbox) was never run, so this measures code mode against our npm server, not sandboxed execution against progressive disclosure.
- Wall-clock timings are omitted: other probes ran against the same Phoenix during the grid, contaminating them. Token and turn counts are timing-independent.
- Single model (Claude Sonnet 5), single Phoenix instance, static dataset.
- Correctness is GPT-5 cross-judged. The same-family (Claude) judge scored code_mode 24/24; it missed answers whose prose contradicted their own correct tables.
