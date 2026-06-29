# Support-bot evals

A small, realistic eval suite for a customer-support FAQ bot, written **twice** —
once in Python (pytest) and once in TypeScript (Vitest) — so you can see the same
ideas in whichever stack you use. Both versions run real LLM calls, score them
with an LLM-as-judge, and record every run to [Phoenix](https://arize.com/docs/phoenix)
as an experiment you can compare over time.

This is the companion code for the "getting started with evals" blog post.

## The scenario

**Acme Analytics** ships a support bot. It receives a user question plus a short
excerpt from the knowledge base and must answer **using only that excerpt**. When
the excerpt is empty or the question is off-topic, it should decline politely:

> "I don't have information on that — please contact support@acme.io."

We test five interactions — four grounded questions (billing, password reset,
data export) and one off-topic question that should be refused.

## What the suite demonstrates

Three patterns that make an eval suite useful in CI, not just a demo:

| Pattern | How | Why |
| --- | --- | --- |
| **Deterministic metric** | `latency_ms` recorded as a `CODE` annotation | Always trustworthy; cheap to track. |
| **LLM-as-judge** | a `helpfulness` score (1/0) judged on the same KB excerpt the bot saw | Captures grounded quality a string match can't. |
| **Hard vs. aggregate gating** | assert only the structural refusal; gate quality on suite-level acceptance criteria | LLMs make occasional mistakes — fail CI on *trends*, not on a single imperfect response. |

A detail worth copying: the judge runs on a **stronger model than the bot**
(Sonnet judging Haiku) and is shown the same knowledge-base excerpt the bot had.
That lets it score groundedness — and recognize that *declining* is the right
answer when the excerpt doesn't contain one. A weaker or context-blind judge is
noisy, which makes the whole suite flaky.

The TypeScript suite gates the run on aggregate acceptance criteria:

- ≥ 70 % of answers judged `helpful` across the suite
- mean `latency_ms` ≤ 5000 ms across the suite

> **Try it:** the `reset-email` case is usually flagged unhelpful — the bot
> suggests "check your spam folder," which isn't in the knowledge base. That's
> the eval catching an ungrounded answer, exactly what you want it to do. The
> Python suite records the same `helpfulness` score per run so you can watch the
> trend in Phoenix without failing the build on it.

## Run it

Both versions read `ANTHROPIC_API_KEY` for the bot and judge. You can iterate
**offline** (nothing sent to Phoenix) or **record runs** to a Phoenix instance.

### Python (pytest)

```bash
cd examples/pytest-example
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...

# Iterate locally without recording anything to Phoenix:
PHOENIX_TEST_TRACKING=0 pytest -v

# Record runs to Phoenix:
export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-host
export PHOENIX_API_KEY=...   # if your deployment requires auth
pytest -v
```

### TypeScript (Vitest)

The TypeScript suite lives in the `js/` pnpm workspace at
`js/examples/apps/vitest-example` and uses the workspace copy of
`@arizeai/phoenix-client`.

```bash
# From the repo root, install the workspace once:
cd js
pnpm install

cd examples/apps/vitest-example
export ANTHROPIC_API_KEY=sk-ant-...

# Iterate locally without recording anything to Phoenix:
pnpm eval:offline

# Record runs to Phoenix:
export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-host
pnpm eval
```

## In CI

`eval-ci.yml` is a copy-paste GitHub Actions workflow with one job per language —
keep the one you need, drop it into `.github/workflows/`, and set the
`ANTHROPIC_API_KEY`, `PHOENIX_COLLECTOR_ENDPOINT`, and `PHOENIX_API_KEY` secrets.
The job fails on the test runner's exit code, so a missed acceptance criterion
(or refusal regression) fails the PR.

## Files

```
examples/pytest-example/           # the Python suite (this folder)
├── README.md
├── eval-ci.yml                    # GitHub Actions recipe (both languages)
├── test_support_bot.py            # the pytest eval suite
└── requirements.txt

js/examples/apps/vitest-example/   # the TypeScript suite (js/ pnpm workspace member)
├── support-bot.eval.ts            # the Vitest eval suite
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

## Learn more

- [Evals in pytest](https://arize.com/docs/phoenix/evaluation/integrations/pytest)
- [Evals in Vitest / Jest](https://arize.com/docs/phoenix/evaluation/integrations/vitest-jest)
