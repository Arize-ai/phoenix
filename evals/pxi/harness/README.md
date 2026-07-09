# PXI Eval Harness

This directory is the runner that turns a YAML dataset into a scored Phoenix
experiment. The top-level [`evals/pxi/README.md`](../README.md) is the *usage*
guide - how to invoke the runner, author datasets, describe inputs, and read a
CI failure. **This document is the *integration* guide**: how the harness wires
into the real Phoenix agent, which production seams it reuses, and the
invariants that keep a run faithful to what the server actually does. When the
two docs would overlap, this one points back to the usage guide rather than
repeating it.

## Production Fidelity

The harness does not mock the agent. It builds the same `pydantic_ai` agent the
Phoenix server builds, feeds it the same context objects the browser agent API
produces, and lets it call the same tools - including the live docs MCP
toolset. Everything in this directory exists to run the production agent
*imperatively*, one example at a time, without a browser or a running FastAPI
app. When the harness deviates from production, it is a bug; the comments in the
code call out each place the two must stay in lockstep.

## Module Map

| File | Responsibility |
| --- | --- |
| `run_experiment.py` | CLI entrypoint and orchestration: parse args, health-check Phoenix, upload the dataset, run the experiment, evaluate it, print the summary, write reports. |
| `agent_task.py` | The bridge to production. Builds the model and agent, translates dataset `messages` into `pydantic_ai` message objects, runs one agent turn, serializes the output. |
| `datasets.py` | Load and validate a dataset YAML into an `EvalDataset` (splits, ids, evaluators, example shape). |
| `reporting.py` | Pure functions over `RanExperiment` - the console summary and the two-tier failure reports. No network calls, so it stays unit-testable. |

## Run Pipeline

`main()` → `run()` → `_run_async()` in `run_experiment.py` is the whole flow:

1. **Health check.** `_check_phoenix_healthz()` hits `/healthz` on the
   configured base URL (retrying transient blips) *before* uploading anything,
   so a down or misconfigured Phoenix fails fast instead of mid-run.
2. **Load + validate.** `load_dataset()` parses the YAML and validates it
   against the `EvalDataset` schema. `_resolve_evaluators()` maps evaluator
   names (from the YAML or the `--evaluator` override) to concrete
   `@create_evaluator` objects, failing fast on unknown names.
3. **Build the shared docs toolset.** `build_shared_docs_mcp_server()` builds
   *one* `MintlifyDocsMCPServer` for the whole run and enters its async context
   via an `AsyncExitStack` - see [Shared Docs MCP Toolset](#shared-docs-mcp-toolset).
4. **Upload the dataset.** `_phoenix_examples()` shapes the YAML examples into
   the client's upload payload, then `create_dataset()` upserts them. A split
   smoke check warns on mismatch; splits with no examples are skipped, not fatal.
5. **Run the experiment.** `client.experiments.run_experiment()` drives the task
   (`make_task()`) over the split-filtered dataset at `concurrency=3`.
6. **Evaluate.** `evaluate_experiment()` scores the task runs. `_check_evaluations_ran()`
   then guards against a false green (see [Run Invariants](#run-invariants)).
7. **Rewrite stable ids.** `_rewrite_stable_example_ids()` swaps Phoenix's relay
   GlobalIDs back to the YAML example ids for reporting - strictly *after*
   evaluation (see invariants).
8. **Summarize + report.** `_print_score_summary()` prints the console tables;
   `build_report()` / `write_reports()` produce the failure artifacts. Report
   *contents* and CI consumption are documented in the usage guide's
   [Failure Reports](../README.md#failure-reports) section.

The exit code is `1` only when `--fail-on-regression` is set and an evaluator
failed on a `regression`-split example; infrastructure errors return `2`.

## Integration Points

Everything under `agent_task.py` imports from `phoenix.server.agents.*` so the
harness never reimplements agent behavior. The seams:

| Production seam | Imported symbol | What the harness reuses |
| --- | --- | --- |
| Agent assembly | `agent_factory.build_agent` | The exact capability wiring, tool set, and output type the server uses. |
| Model construction | `model_factory._build_openai_model`, `azure_endpoint_to_base_url` | The low-level OpenAI/Azure model *builder* only. Provider *resolution* is harness-local, not shared - see [Model Selection](#model-selection). |
| Docs tools | `capabilities.MintlifyDocsMCPServer` | The live docs MCP toolset the agent calls at runtime. |
| Page state | `context.ChatContext`, `resolve_contexts`, `ProjectContext` | The same context objects the browser agent API builds from page state. |
| Feature gates | `config.get_env_disable_agent_assistant`, `get_env_allow_external_resources` | The production gate deciding whether docs tools are attached. |
| Deps + output | `types.AgentDependencies`, `AgentOutput` | The typed dependency and output contracts `build_agent` expects. |

Because `build_agent` is called directly, any change to the production agent's
tools or capabilities is picked up by the next eval run with no harness edit.

### Model Selection

Model resolution is **not** shared with production - this is the one place the
harness deliberately diverges. `agent_task.py::_build_model()` is a small,
env-only resolver: it reads `PHOENIX_AGENTS_ASSISTANT_PROVIDER` and
`PHOENIX_AGENTS_ASSISTANT_MODEL` (defaults: `OPENAI` / `gpt-5.4`) and dispatches
to one of just three providers - OpenAI, Azure OpenAI, or Anthropic - reading
credentials from the normal env vars (`OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`,
`ANTHROPIC_API_KEY`). It reuses only the low-level `_build_openai_model` helper.

The production `model_factory.build_model()` is broader: it resolves credentials
**secret-store-first, environment-second**, and supports custom-provider records
including AWS Bedrock, Google GenAI, and OpenAI-compatible providers on top of
the three above. The harness does not exercise any of that path, so an eval run
tests the agent under a narrower model-resolution surface than a live server.
Keep this in mind before concluding an eval result generalizes to a provider the
harness can't construct.

All clients are built with `max_retries=0` so a flaky example surfaces as a task
error rather than silently retrying and skewing latency/cost. When a custom
`OPENAI_BASE_URL` is set without a key, the harness warns and uses a placeholder
key (a self-hosted or proxy endpoint, not the real OpenAI API). See the usage
guide's [Model Configuration](../README.md#model-configuration) for the
operator-facing view of these env vars.

### Shared Docs MCP Toolset

`build_shared_docs_mcp_server()` builds the docs toolset **once per run** and the
orchestrator enters its async context for the whole run, mirroring the server's
FastAPI lifespan (`phoenix.server.app`, where the toolset is entered via the
lifespan `AsyncExitStack`). This is not an optimization - it is required for
correctness. A fresh toolset per task under concurrency makes `anyio` raise
*"Attempted to exit cancel scope in a different task than it was entered in"*,
because the underlying streamable-HTTP client opens and closes cancel scopes
that cross task boundaries. `make_task()` binds the single shared toolset into
every concurrent task run to satisfy anyio's single-owner rule.

The toolset is only built when `should_build_docs_mcp_server()` returns true -
the same gate the server uses: the assistant must not be disabled
(`PHOENIX_DISABLE_AGENT_ASSISTANT`) and external resources must be allowed
(`PHOENIX_ALLOW_EXTERNAL_RESOURCES`). If either gate is off the experiment
still runs, but the agent has no docs tools - matching a server deployment with
those gates off.

## Message Priming

How a dataset example selects *which step* of the agent loop is scored - via the
trailing message role - is covered for dataset authors in the usage guide's
[Inputs](../README.md#inputs) section. This note covers only the two code-level
invariants `agent_task.py` enforces when it materializes those messages into
`pydantic_ai` objects, because they are easy to break when extending the
translator:

- **Primed calls are indistinguishable from real ones.** `_materialize_messages()`
  builds the exact same `ToolCallPart` / `ToolReturnPart` shapes pydantic_ai
  produces for genuinely-executed tools, so the model cannot tell a primed tool
  return from one it actually triggered. Preserve this when adding new turn
  shapes - the moment a primed turn looks different, the eval stops measuring
  production behavior.
- **Tool-call/return pairing is validated, not assumed.** Every assistant
  `tool_calls` entry must be matched later by a `role: tool` return with the
  same `tool_call_id` *and* `name`; ids must be unique across the whole list;
  unpaired calls raise. This is what lets a dataset simulate a multi-turn
  session without the harness executing any real tools.

`run_pxi_example()` wraps the whole turn in a try/except: any setup or
`agent.run` failure is caught and returned with a bounded `error` field (type +
truncated message, no stack traces) so the failure report can still resolve a
stable example id for the row. That bounded error is uploaded to Phoenix as-is,
so avoid pasting credentials into request URLs when debugging against a shared
instance.

## Run Invariants

The runner has two guards against a **false green** - a run that reports success
without actually testing anything. Both stem from real incidents (see the
comments in `run_experiment.py`):

- **`_check_evaluations_ran()`** raises if task runs executed but *zero*
  evaluations did. The client pairs evaluators with examples via the example
  node GlobalID and silently skips runs whose lookup misses; if that pairing
  breaks, every example counts as vacuously passed. This turns a silent false
  green into a loud infrastructure error.
- **Ordering of `_rewrite_stable_example_ids()`.** Stable-id rewriting *must*
  happen after `evaluate_experiment()`. Rewriting first changes the GlobalIDs
  the client uses to pair evaluators with examples, making every lookup miss and
  skipping all evaluations - the exact false-green failure mode the guard above
  catches. The two are a matched pair: order it wrong and the guard fires.

## Extending the Harness

- **New provider** → add a branch in `agent_task.py::_build_model()`; reuse the
  server's `model_factory` builders rather than constructing a model by hand.
- **New example / turn shape** → extend `_materialize_messages()` and its
  per-turn builders; keep the two invariants in
  [Message Priming](#message-priming).
- **New report field** → add to the `Report`/`ExampleFailure` dataclasses in
  `reporting.py` and render in both tiers; the JSON tier must never truncate
  example data.
- **New CLI flag** → add to `build_parser()` and thread it through
  `ExperimentConfig`.

Fast unit coverage lives under `tests/unit/pxi/evals/`. Because `reporting.py`
and `datasets.py` avoid network calls, most harness logic is testable without a
live Phoenix.
