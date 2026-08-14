# Evals

Vitest suites that measure prompt quality with [Phoenix experiments](https://arize.com/docs/phoenix), kept apart from the unit tests because they call real LLMs. Run them with:

```bash
pnpm eval  # records experiments to PHOENIX_HOST (default http://localhost:6006)
```

## AI query (`evals/aiQuery`)

Hill-climbing harnesses for the filter-DSL prompt in
`src/components/filter/ai/buildAIQueryPrompt.ts`, exercised against the
production DSLs the filter fields actually ship:

- `spanFilterPrompt.eval.ts` — the span DSL from
  `src/pages/project/spanFilterDSL.ts`
- `sessionFilterPrompt.eval.ts` — the session DSL from
  `src/pages/project/sessionFilterDSL.ts`, backed by a generated core vocabulary
- `experimentRunFilterPrompt.eval.ts` — the experiment run DSL from
  `src/pages/experiment/experimentRunFilterDSL.ts`
- `spanFilterIntent.eval.ts` — semantic fidelity over the span DSL:
  requests about phenomena ("there is an apology in the response") must
  translate into searches for the text the phenomenon leaves in the data
  (`'sorry' in output.value`), not literal echoes of the request
  (`'apology' in input.value`)

The correctness prompt suites grade each model in `googleModels.ts`: each
translates the requests in the suite's case file, and a case counts as
correct on a normalized exact match, or when the judge model rules the
expression equivalent. The intent suite has no accepted-expression list —
query expansion has no single right answer — so its judge grades against a
described phenomenon, expected fields, and illustrative surface forms
instead. A suite passes only when its gated rate (`filter_correct`, or
`intent_captured` for the intent suite) clears the model's bar — raise
those bars as the prompt improves.

The session DSL's static AI vocabulary is generated from the server compiler
bindings. Run `make gen-session-filter-ai-query-vocabulary` after changing that
surface; `make check-session-filter-ai-query-vocabulary` detects drift.

The Gemma model proxies the default on-device browser model (Gemma is
Gemini Nano's open-model family, and it takes the system prompt folded
into the first user turn, like the browser Prompt API); the flash-lite
tiers proxy the smallest hosted provider models.

When recording to a Phoenix, every AI SDK call (generations and the
judge) is traced via `telemetry.ts` — each experiment run's trace shows
the LLM spans under the test's task span.

### Environment

| Variable                                             | Purpose                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`) | Required — the suites skip without it                                                                                 |
| `PHOENIX_HOST` / `PHOENIX_API_KEY`                   | Where runs record as experiments — defaults to http://localhost:6006; set `PHOENIX_TEST_TRACKING=false` for a dry run |

Variables are read from `js/app/.env` (shell variables win).
