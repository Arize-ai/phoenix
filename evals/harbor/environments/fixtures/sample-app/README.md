# The sample-app fixture

A small, uninstrumented LLM app and a Phoenix database seeded from it. Skill tasks and
the Harbor setup tasks use it.

| Path | Contents | In the image |
| --- | --- | --- |
| `workdir/` | The Acme support bot and a fake LLM gateway | Copied to `/app`, owned by the agent |
| `fixture.sh` | Writes `phoenix.db`; staging calls it | No |
| `seed.py` | Starts a scratch Phoenix and the gateway, runs the instrumented bot, and uploads the datasets | No |
| `reference/instrument.py` | The reference OpenInference instrumentation that `seed.py` applies | No |
| `datasets.json` | The datasets that `seed.py` uploads | No |

The bot calls `gpt-4o-mini` through `ACME_LLM_GATEWAY_URL`, which defaults to the fake
gateway at `http://127.0.0.1:8100/v1`. The gateway answers with fixed, rule-based
replies, so the seed, the agents, and the verifiers run the bot with no model provider
and no key.

## What the database holds

`seed.py` writes these counts to `summary.json` beside the database:

| Item | Count | Notes |
| --- | --- | --- |
| Traces in `support-bot` | 32 | One AGENT root span per answer, with LLM and TOOL children |
| Sessions | 24 | `session.id` is the conversation ID |
| Rate-limited traces | 4 | The gateway returns 429 when "Summarize every store policy" loads the whole handbook. The LLM and root spans have status `ERROR`. |
| Hallucinated-column traces | 4 | The model queries `customer_email`, which doesn't exist. `run_sql` returns the error in its output, the spans stay `OK`, and the bot says no customer has an email. |
| `support-qa` dataset | 10 examples | `input.question` and `output.expected`. The bot answers 7 correctly, 2 wrongly, and fails 1 on the rate limit. |
| `support-answers-labeled` dataset | 20 examples | `input.question`, `input.context`, `input.answer`, and an analyst's `output.label`: 12 grounded and 8 ungrounded |
| `groundedness-judge-v1` experiment | 20 runs | A judge's `groundedness` label on each labeled example. It disagrees with the analyst on 4. |

To change the bot's behavior, edit the rules in `workdir/dev/fake_gateway.py`. Then
restage with `RESEED=1` and check every task that uses this fixture with `-a oracle`.
