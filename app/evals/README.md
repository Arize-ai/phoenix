# Evals

Vitest suites that measure prompt quality with [Phoenix experiments](https://arize.com/docs/phoenix), kept apart from the unit tests because they call real LLMs. Run them with:

```bash
pnpm eval  # records experiments to PHOENIX_HOST (default http://localhost:6006)
```

## AI query (`evals/aiQuery`)

Hill-climbing harness for the filter-DSL prompt in
`src/components/filter/ai/buildAIQueryPrompt.ts`, exercised against the
production span DSL exported by `src/pages/project/spanFilterDSL.ts`.

Each model in `googleModels.ts` translates the requests in
`spanFilterCases.ts`; a case counts as correct on a normalized exact match,
or when the judge model rules the expression equivalent. A suite passes
only when its `filter_correct` rate clears the model's `minPassRate` —
raise those bars as the prompt improves.

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

Variables are read from `app/.env` (shell variables win).
