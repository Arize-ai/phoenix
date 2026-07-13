# Token Cost and Context-Window Usage

Token counts and cost live on `LLM` spans and roll up to traces, sessions, and projects. Read them to
answer "how expensive is this?", "is this call about to overflow the context window?", and "where is
the spend concentrated?".

## Token counts on an LLM span

Raw OpenInference attributes (also exposed as GraphQL `Span.tokenCountPrompt` / `…Completion` / `…Total`):

- `llm.token_count.prompt` — tokens in the input (the context sent to the model).
- `llm.token_count.completion` — tokens the model generated.
- `llm.token_count.total` — prompt + completion.

**Detail breakdowns** refine the prompt/completion totals — they are *subsets*, **not additive on top**
of `prompt`/`completion`:

- `llm.token_count.prompt_details.cache_read` — prompt tokens served from a prompt cache (cheaper).
- `llm.token_count.prompt_details.cache_write` — prompt tokens written into the cache.
- `llm.token_count.prompt_details.audio` — audio tokens within the prompt.
- `llm.token_count.completion_details.reasoning` — "thinking"/reasoning tokens inside the completion
  (billed, often invisible in the final message).
- `llm.token_count.completion_details.audio` — audio tokens within the completion.

So `prompt` already includes its `cache_read` and `cache_write` portions; don't sum them with `prompt`.

## Cost

- Raw attributes: `llm.cost.prompt`, `llm.cost.completion`, `llm.cost.total`, plus
  `llm.cost.prompt_details.*` (`input`, `cache_read`, `cache_write`, `cache_input`, `audio`) and
  `llm.cost.completion_details.*` (`output`, `reasoning`, `audio`). Values are USD.
- GraphQL: `Span.costSummary { prompt { tokens cost } completion { tokens cost } total { tokens cost } }`
  (a `SpanCostSummary` of `CostBreakdown`s). Project/experiment aggregates expose `costSummary` too.
- Cost is **computed by Phoenix** from token counts and a per-model price table — it is not emitted by
  the app. If a model is unpriced or token counts are missing, cost may be null even when tokens exist.

## Cumulative rollups

A parent span's own token count covers only its direct work. To see a subtree's total, use the
cumulative fields, which sum the span **and all descendants**:

- GraphQL: `Span.cumulativeTokenCountTotal`, `cumulativeTokenCountPrompt`, `cumulativeTokenCountCompletion`.
- Trace/project/session totals aggregate the same way (`tokenCountTotal`, `tokenCountPrompt`, …).
- Session `filterCondition`/sort exposes `cumulativeTokenCountTotal` and `tokenCostTotal` columns.

Rule of thumb: **cumulative** on a root/agent span = cost of the whole turn; **non-cumulative** on an
LLM span = cost of that one call.

## Reasoning about context-window usage

There is no "context window size" attribute — the window is a property of the model, not the span. To
gauge context pressure, compare `llm.token_count.prompt` (what was sent) against the known limit of
`llm.model_name`:

- A prompt token count approaching the model's window means later turns risk truncation or a hard error;
  flag it and suggest trimming history, summarizing, or moving to a larger-window model.
- A large and *growing* `llm.token_count.prompt` across the turns of one `session.id` is the classic
  multi-turn-agent failure: unbounded history accumulation. Look at prompt tokens per turn, not just the
  total.
- High `completion_details.reasoning` with a small visible answer explains "why did this cost so much?" —
  the spend is in hidden reasoning tokens.

## Common questions → where to look

| Question | Read |
| -------- | ---- |
| Cost of one model call | `Span.costSummary.total.cost` (or `llm.cost.total`) on that LLM span |
| Cost of a whole agent turn | `costSummary` on the root/trace, or `cumulativeTokenCountTotal` × price |
| Is a prompt cache helping? | `prompt_details.cache_read` as a share of `prompt` |
| Why is completion so large? | `completion_details.reasoning` |
| Is context growing turn over turn? | `llm.token_count.prompt` across spans sharing a `session.id` |
