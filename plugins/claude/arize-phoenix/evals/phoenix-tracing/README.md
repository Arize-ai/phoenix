# phoenix-tracing plugin evals

Behavioral tests for the `phoenix-tracing` skill, run with `claude plugin eval`. They check that
the skill fires when a user needs to instrument an app with OpenInference, stays quiet when the
request belongs to another Phoenix skill, and that the setup or custom-span code it produces
follows the skill's conventions: selects `arize-phoenix-otel` / `@arizeai/phoenix-otel`, calls
`register()` with valid config, uses the right OpenInference span kind and semantic attributes,
keeps credentials out of source, and gives runnable verification steps.

Cases live in this group directory (tagged `phoenix-tracing`) so they run apart from the
`phoenix-cli` and `phoenix-evals` cases. Every input runs with the plugin and without it, so the
headline number is Δ (with-plugin minus without-plugin).

## Cases

| Case | Fire? | Lang | What it checks |
| ---- | ----- | ---- | -------------- |
| `01-instrument-openai-python` | yes | Python | `register(auto_instrument=True)` / `OpenAIInstrumentor` with `arize-phoenix-otel`; verification steps |
| `02-configure-export-cloud` | yes | Python | `register(endpoint=…)` to Phoenix Cloud; API key from env, never hardcoded |
| `03-manual-llm-span-python` | yes | Python | A manual LLM span for a non-instrumented provider using the correct OpenInference attribute names (`llm.model_name`, `llm.input_messages.*`, `llm.token_count.*`) |
| `04-esm-load-order-typescript` | yes | TypeScript | ESM hoisting gotcha: instrument OpenAI via `manuallyInstrument`/`registerInstrumentations` after `register()`, not the broken auto pattern |
| `05-custom-span-typescript` | yes | TypeScript | A TOOL span via `traceTool` / `withSpan` from `@arizeai/openinference-core` |
| `06-session-tracking-python` | yes | Python | Group a multi-turn conversation with `using_session` / a shared session id |
| `07-neg-build-evaluator` | no | — | Building an LLM judge — belongs to `phoenix-evals`; the tracing skill must stay quiet |
| `08-neg-generic-logging` | no | — | Standard-library log rotation — no Phoenix tracing needed |

## Run

From the plugin directory (`plugins/claude/arize-phoenix`):

```bash
claude plugin eval . \
  --tag phoenix-tracing \
  --ablation with-without \
  --judge-model claude-sonnet-5 \
  --allow-tools Write "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
```

Iterate on one case with `--case 03-custom-tool-span-python --runs 1`. The fire cases write a
file (`--allow-tools Write`) and the graders read it back via `target: {source: file, path: ...}`;
no case runs the file or reaches a live Phoenix, so no mock is needed.

## Grader conventions

Deterministic graders first (`file_exists`, `regex` over the written file and the final message),
then one `llm` grader per claim at `weight: 0.5` — the judge fails combined rubrics, so each claim
is graded alone. `skill-fired` is reported under ablation but not scored. The two negatives use
`skill-not-used` (`tool: Skill`, `input_match: phoenix-tracing`, `min: 0`, `max: 0`, `arm: both`);
the match is the narrow `phoenix-tracing`, so `07` still lets the `phoenix-evals` skill fire.

## Record to Phoenix

Reuse the shared recorder with a tracing dataset name (needs a running Phoenix and the project's
Python; see the phoenix-evals README for the env note):

```bash
claude plugin eval . --tag phoenix-tracing --ablation with-without \
  --judge-model claude-sonnet-5 --trust-plugin --no-publish --json /tmp/pt.json \
  --allow-tools Write "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
uv run python evals/record_to_phoenix.py /tmp/pt.json --dataset-name plugin-eval-phoenix-tracing
```
