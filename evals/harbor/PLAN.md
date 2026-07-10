# Harbor POC: Behavioral eval of the Phoenix ServerAgent

**Goal:** Run a multi-step, real-model behavioral test of the Phoenix ServerAgent inside
[Harbor](https://www.harborframework.com/docs), against a deterministically seeded Phoenix
database, with programmatic verifiers scoring each step.

This is a plan for an implementing agent. Every design decision has already been made —
follow the plan as written. When a detail is marked **VERIFY**, confirm it against the
named source before using it (docs may have drifted or a signature may differ), but do
not redesign around it.

---

## 1. Background you need (read this, don't rediscover it)

### What we are testing

The **ServerAgent** — built by `build_server_agent()` in
`src/phoenix/server/agents/server_agents.py:49`. It is a pydantic-ai v2 agent whose only
tools are:

- `bash` — an in-process virtual shell (bashkit) with coreutils + `jq` + `bc`. No network,
  no python. See `src/phoenix/server/agents/capabilities/tools/internal/bash.py`.
- `phoenix-gql` — a bash builtin that executes GraphQL **in-process** against the
  strawberry schema (`create_phoenix_gql_builtin`, same file, ~line 253). Read-only unless
  the agent is built with `allow_mutations=True`. This is the agent's ONLY data access —
  no REST, no SQL.
- `load_skill` / `read_skill_resource` — one skill, `phoenix-graphql`
  (`src/phoenix/server/agents/prompts/skills/phoenix-graphql/SKILL.md`), which teaches it
  the GraphQL entrypoints.

We test the agent **in isolation** — no HTTP server, no browser, no SSE. A small runner
script constructs the agent directly and calls `agent.run(instruction)`. The FastAPI app
object is used purely as a dependency container to obtain a real GraphQL context:

- `create_app(db=..., authentication_enabled=False, serve_ui=False)` — see the test
  fixture at `tests/unit/conftest.py:298-315` for the exact pattern (including
  `LifespanManager`).
- `app.state.graphql_schema` and `app.state.build_graphql_context` are set in
  `src/phoenix/server/app.py:1140-1141`.
- `build_graphql_context(user)` accepts `None` for an unauthenticated context
  (`src/phoenix/server/app.py:1231`).

Because we bypass the HTTP router, we do NOT need the `agent_assistant_enabled` system
setting, auth, or any `PHOENIX_*` feature env vars.

### How Harbor works (facts pulled from harborframework.com docs, 2026-07)

- A **task** is a directory: `task.toml` + `instruction.md` + `environment/Dockerfile`
  + `tests/test.sh` (verifier) + optional `solution/solve.sh` (oracle).
- The verifier runs `tests/test.sh` inside the container and must write a reward file:
  `/logs/verifier/reward.txt` (a bare number) or `/logs/verifier/reward.json`
  (multiple metrics; `reward.json` wins if both exist).
- **Multi-step tasks**: `[[steps]]` entries in `task.toml`, executed in declaration order
  in ONE shared container. Each step has its own `instruction.md`, `tests/`, and optional
  `workdir/` (staged into the container before the step's agent runs). `min_reward` on a
  step aborts later steps if not met. `multi_step_reward_strategy = "mean"` (default)
  averages step rewards. **VERIFY** the per-step directory naming convention by running
  `harbor init` or reading https://www.harborframework.com/docs/tasks/multi-step — this
  plan assumes `steps/<name>/instruction.md`.
- **Custom agents**: implement Harbor's `BaseAgent` interface — `name()`, `version()`,
  `setup()`, `run()` (which receives the instruction + an environment handle and
  populates an `AgentContext`). Launch with
  `harbor run -p <task-path> --agent <python.module.path>:<ClassName>`.
  **VERIFY** exact method signatures against the installed `harbor` package source —
  the docs (https://www.harborframework.com/docs/agents) are thin. Steps are run
  against the same agent; each step's instruction arrives as a separate `run()` call.
- Container paths: `/logs/verifier/` (reward output), `/logs/agent/` (agent scratch,
  readable by the verifier in shared mode), `/tests/` (the step's tests dir), `/solution/`.

### Environment state vs agent memory

The ServerAgent has no session memory in this harness — each step is a fresh
`agent.run()`. What persists across steps is the **database** (shared container).
Step instructions are therefore fully self-contained; later steps re-derive what they
need rather than referring to "the previous answer".

---

## 2. Deliverables & layout

Everything lives under `evals/harbor/`:

```
evals/harbor/
├── PLAN.md                          # this file
├── README.md                        # written in M6: how to run the POC
├── agents/
│   └── phoenix_server_agent.py      # Harbor BaseAgent adapter (runs on host)
├── runner/
│   └── run_server_agent.py          # in-container runner (copied into the image)
└── tasks/regression-triage/
    ├── task.toml
    ├── environment/
    │   ├── Dockerfile
    │   ├── seed_db.py               # deterministic DB seeder
    │   └── wheels/                  # arize-phoenix wheel, built locally (.gitignored)
    ├── steps/
    │   ├── 01-aggregate/{instruction.md, workdir/step-config.json, tests/check.py}
    │   ├── 02-diagnose/{instruction.md, workdir/step-config.json, tests/check.py}
    │   ├── 03-trace-drilldown/{instruction.md, workdir/step-config.json, tests/check.py}
    │   └── 04-create-split/{instruction.md, workdir/step-config.json, tests/check.py}
    ├── solution/
    │   ├── solve.sh
    │   └── solve.py                 # oracle: replays ground truth through the runner's output contract
    └── tests/
        └── test.sh                  # shared verifier entrypoint (runs the step's check.py)
```

---

## 3. The scenario and its exact ground truth

Story: a QA bot's `candidate-v2` experiment added a translation step that breaks on
Spanish inputs. The agent must find the regression, explain it, drill into the failing
trace, and create a dataset split of the regressed examples.

The seed script is the single source of truth. It creates:

**Target data (dataset `qa-bot-golden`):**
- 30 examples with keys `ex-001` … `ex-030`. Each example's **metadata** JSON contains
  `{"example_key": "ex-NNN"}` (this is how the agent and verifiers identify examples —
  DB row ids and GraphQL global IDs are not stable identifiers for answers).
- Inputs: `{"question": "..."}`. Exactly six examples have Spanish-language questions:
  **ex-005, ex-009, ex-014, ex-021, ex-026, ex-030**. All other questions are English.
  Write real, varied question text (e.g. "¿Cuál es la política de devoluciones?") —
  the pattern must be discoverable but not labeled.
- Two experiments on that dataset:
  - `baseline-gpt4o`: `correctness` = 1.0 on 27 examples; 0.0 on **ex-003, ex-011,
    ex-017** (hard examples that fail in BOTH experiments — these are the distractors
    that make "score == 0" the wrong strategy). Mean = 27/30 = **0.9**.
  - `candidate-v2`: `correctness` = 0.0 on those same three PLUS the six Spanish
    examples; 1.0 elsewhere. Mean = 21/30 = **0.7**.
- Regressed set (baseline 1.0 → candidate 0.0) = the six Spanish examples exactly.
- Every `candidate-v2` run has a trace in project `experiment-runs`
  (3 spans: `agent_run` → `translate_query` → `llm_call`). In the six regressed runs,
  the `translate_query` span has status ERROR and an OTel exception event with message
  `UnsupportedLocaleError: locale 'es' is not enabled for translation`; `llm_call` is
  omitted in those traces (the pipeline died at translation).

**Distractors:**
- A second dataset `checkout-flows` (10 examples) with one experiment
  `checkout-baseline` (all passing).
- An unrelated project `demo-chatbot` with ~5 simple traces.

**Ground truth file** — the seeder writes `/data/ground_truth.json`:

```json
{
  "step1": {
    "lower_experiment": "candidate-v2",
    "means": {"baseline-gpt4o": 0.9, "candidate-v2": 0.7}
  },
  "step2": {
    "regressed_example_keys": ["ex-005", "ex-009", "ex-014", "ex-021", "ex-026", "ex-030"],
    "pattern_keywords": ["spanish", "español", "espanol"]
  },
  "step3": {
    "target_example_key": "ex-014",
    "span_name": "translate_query",
    "exception_substring": "UnsupportedLocaleError"
  },
  "step4": {
    "split_name": "regressions",
    "expected_example_keys": ["ex-005", "ex-009", "ex-014", "ex-021", "ex-026", "ex-030"]
  }
}
```

**Determinism rules (hard requirements):**
- No `random`, no `datetime.now()`. Use a fixed base timestamp
  (`2026-06-01T00:00:00Z`) plus fixed per-row offsets.
- Trace/span IDs derived deterministically (e.g. `hashlib.sha256(f"trace-{key}").hexdigest()[:32]`
  formatted per OTel hex conventions — copy the format used by existing seeders).
- Running the script twice against fresh DBs must produce identical ground truth.

---

## 4. Milestones

Work them in order; each has acceptance criteria. Commit after each milestone.

### M1 — Seed script (`evals/harbor/tasks/regression-triage/environment/seed_db.py`)

A standalone script: `python seed_db.py --db-path /data/phoenix.db --ground-truth-out /data/ground_truth.json`.

**How to build it:**
1. Create the engine with `phoenix.db.engines.create_engine(...)` with migrations enabled
   (see `src/phoenix/db/engines.py:77` for the signature). Follow
   `scripts/seed_vendor_tool_spans.py` — it is the canonical example of a standalone
   script that opens a Phoenix DB with async SQLAlchemy and inserts ORM rows.
2. Insert rows using `phoenix.db.models` classes. Copy field usage from these references:
   - Datasets/examples/revisions: `models.Dataset` (models.py:1297), `DatasetVersion`
     (:1405), `DatasetExample` (:1418), `DatasetExampleRevision` (:1452). See how
     `tests/unit/server/api/conftest.py` builds them.
   - Experiments: `Experiment` (:1535), `ExperimentRun` (:1634),
     `ExperimentRunAnnotation` (:1678) — `tests/unit/server/api/conftest.py` and
     `tests/unit/server/api/routers/v1/test_experiments.py` seed all three; mirror their
     field values (annotation `name="correctness"`, numeric `score`, and whatever
     `annotator_kind` the reference uses).
   - Projects/traces/spans: `Project` (:695), `Trace` (:758), `Span` (:817). Copy span
     attribute shapes from `scripts/seed_vendor_tool_spans.py`. For the exception event,
     grep the repo for `exception.message` to find the exact events-list shape used in
     fixtures (an OTel event dict with `name: "exception"` and
     `attributes: {"exception.message": ..., "exception.type": ...}`), and set the span
     `status_code` to `ERROR`.
   - Link each `ExperimentRun.trace_id` to its trace.
3. Compute the ground-truth JSON **from the same in-memory structures** used to insert
   (do not re-query), and write it out.

**Acceptance criteria:**
- `python seed_db.py --db-path /tmp/x.db --ground-truth-out /tmp/gt.json` exits 0.
- These SQL checks pass (`sqlite3 /tmp/x.db`):
  - `SELECT COUNT(*) FROM dataset_examples;` → 40 (30 + 10 distractor)
  - `SELECT COUNT(*) FROM experiments;` → 3
  - `SELECT COUNT(*) FROM experiment_runs;` → 70
  - mean correctness per experiment (join `experiment_run_annotations`) → 0.9 / 0.7 / 1.0
  - exactly 6 spans named `translate_query` with ERROR status
- Run the script twice against two fresh DBs; the two ground-truth files are identical.
- A pytest-style sanity test is nice-to-have, not required for the POC.

### M2 — In-container runner (`evals/harbor/runner/run_server_agent.py`)

CLI: `python run_server_agent.py --db-path /data/phoenix.db --instruction-file F
--model anthropic:claude-sonnet-4-5 --out-dir D [--allow-mutations]`.

**Implementation sketch:**

```python
engine = <same engine helper as seed script, migrate already done>
db = DbSessionFactory(db=_db(engine), dialect=...)   # copy tests/unit/conftest.py:270-273
app = create_app(db=db, authentication_enabled=False, serve_ui=False)
async with LifespanManager(app):                     # pip: asgi-lifespan
    agent = build_server_agent(
        model=infer_model(args.model),               # pydantic_ai.models.infer_model — VERIFY
        schema=app.state.graphql_schema,
        build_graphql_context=lambda: app.state.build_graphql_context(None),
        allow_mutations=args.allow_mutations,
    )
    result = await agent.run(instruction_text)
```

- **VERIFY** `pydantic_ai.models.infer_model` exists in the installed pydantic-ai v2; if
  not, construct the provider model class directly (e.g.
  `pydantic_ai.models.anthropic.AnthropicModel`). Support the literal value
  `--model test` → `pydantic_ai.models.test.TestModel(call_tools=[])` for keyless
  plumbing smoke tests.
- Write to `--out-dir`:
  - `answer.md` — `result.output` verbatim.
  - `answer.json` — the LAST fenced ```json block extracted from `result.output`
    (regex), or `{}` if none.
  - `messages.json` — `pydantic_ai.messages.ModelMessagesTypeAdapter.dump_json(result.all_messages())`
    (**VERIFY** the adapter's import path in the installed version).
  - `usage.json` — token usage from `result.usage()`.
- Exit 0 even if the agent's answer is wrong (correctness is the verifier's job);
  exit nonzero only on infrastructure errors.

**Acceptance criteria (all runnable locally, no Docker):**
- `--model test` run against the M1 DB completes and writes all four files.
- A real-model run (`ANTHROPIC_API_KEY` set) with the Step-1 instruction (§5) produces
  an `answer.json` naming `candidate-v2` — i.e. the scenario is actually solvable.
  If the agent fails, debug the *scenario* (is the data discoverable via GraphQL?)
  before touching the runner.
- With `--allow-mutations` absent, a mutation attempt via `phoenix-gql` is refused
  (covered by existing unit tests; just don't invert the flag).

### M3 — Task environment (Dockerfile + task.toml)

**Wheel build (host-side prep, document in README):** Harbor builds the image with
`environment/` as the Docker context, so the repo isn't reachable via COPY. Before
`harbor run`, from the repo root:

```bash
uv build --wheel
cp dist/arize_phoenix-*.whl evals/harbor/tasks/regression-triage/environment/wheels/
```

Add `wheels/` to `.gitignore`.

**Dockerfile** (`environment/Dockerfile`):

```dockerfile
FROM python:3.11-slim
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl asgi-lifespan
COPY seed_db.py /opt/phoenix-eval/seed_db.py
COPY run_server_agent.py /opt/phoenix-eval/run_server_agent.py
RUN mkdir -p /data && python /opt/phoenix-eval/seed_db.py \
      --db-path /data/phoenix.db --ground-truth-out /data/ground_truth.json
```

(Copy `run_server_agent.py` into `environment/` as part of the prep script alongside the
wheel, or use a symlink-free `cp` in a small `prepare.sh`.) Baking the seeded DB into the
image keeps every trial hermetic and startup instant.

**task.toml** — start from this draft and **VERIFY** field placement against
`harbor init` output and https://www.harborframework.com/docs/tasks/multi-step:

```toml
schema_version = "1.3"

[task]
name = "arize/phoenix-regression-triage"
description = "Multi-step behavioral eval: Phoenix ServerAgent triages an experiment regression via phoenix-gql"
keywords = ["phoenix", "agent", "graphql", "regression"]

[environment]
os = "linux"
cpus = 2
memory_mb = 4096
network_mode = "public"                 # the model API is called from inside the container
build_timeout_sec = 1200.0
env = { ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}" }

multi_step_reward_strategy = "mean"

[[steps]]
name = "01-aggregate"
min_reward = 1.0                        # gate: if the agent can't even aggregate, stop
[steps.agent]
timeout_sec = 900.0
[steps.verifier]
timeout_sec = 120.0

[[steps]]
name = "02-diagnose"
[steps.agent]
timeout_sec = 900.0

[[steps]]
name = "03-trace-drilldown"
[steps.agent]
timeout_sec = 900.0

[[steps]]
name = "04-create-split"
[steps.agent]
timeout_sec = 900.0
```

**Acceptance criteria:** `docker build evals/harbor/tasks/regression-triage/environment`
succeeds; running the M1 SQL checks inside the built image passes.

### M4 — Harbor agent adapter (`evals/harbor/agents/phoenix_server_agent.py`)

A Harbor `BaseAgent` subclass that runs on the host and drives the runner inside the
container. Per step, its `run()` must:

1. Write the step's instruction text into the container (heredoc via the environment's
   exec API) at `/tmp/instruction.md`.
2. Read `/tmp/step-config.json` if present (staged from the step's `workdir/`) — schema:
   `{"allow_mutations": bool}`; default `false`.
3. Maintain a step counter file `/logs/agent/step_counter` (create with `0` if missing,
   increment). Let `N` be the new value.
4. Exec:
   ```
   python /opt/phoenix-eval/run_server_agent.py \
     --db-path /data/phoenix.db \
     --instruction-file /tmp/instruction.md \
     --model <mapped model string> \
     --out-dir /logs/agent/steps/N [--allow-mutations]
   ln -sfn /logs/agent/steps/N /logs/agent/latest
   ```
5. Map Harbor's model naming (`anthropic/claude-...`, from `-m`) to pydantic-ai's
   (`anthropic:claude-...`).
6. Surface the runner's `answer.md` into the `AgentContext` result field(s) —
   **VERIFY** the `AgentContext` attributes in the harbor package source.

**Acceptance criteria:** `harbor run -p evals/harbor/tasks/regression-triage
--agent evals.harbor.agents.phoenix_server_agent:PhoenixServerAgent
-m anthropic/claude-sonnet-4-5` executes all four steps (rewards may be 0 until M5).
Check the install command for harbor itself at https://www.harborframework.com/docs
(`uv tool install ...` or `pip install ...`) — record it in the README.

### M5 — Verifiers

Shared `tests/test.sh` (each step's `tests/` also gets a copy or harbor's per-step tests
override — **VERIFY** which of shared vs per-step `tests/` harbor stages at `/tests/`):

```bash
#!/bin/bash
python /tests/check.py
# check.py writes /logs/verifier/reward.json itself; fall back to 0 on crash
if [ $? -ne 0 ] && [ ! -f /logs/verifier/reward.json ]; then
  echo 0 > /logs/verifier/reward.txt
fi
```

Each step's `tests/check.py` reads `/logs/agent/latest/answer.json` +
`/data/ground_truth.json`, writes `/logs/verifier/reward.json`:

- **01-aggregate:** `answer["lower_experiment"] == gt["lower_experiment"]` AND both means
  within `±0.001`. Reward 1.0 / 0.0 (binary — this step gates).
- **02-diagnose:** two components, averaged into the reward and reported separately:
  - `ids`: exact set equality of `regressed_example_keys` (1.0/0.0).
  - `pattern`: 1.0 if any of `gt["step2"]["pattern_keywords"]` appears
    case-insensitively in `answer["pattern"]`, else 0.0.
  - Write `{"reward": mean, "ids": ..., "pattern": ...}`.
- **03-trace-drilldown:** span name exact match AND exception substring present.
- **04-create-split:** ignore the answer text; query the DB directly:
  ```python
  # sqlite3 on /data/phoenix.db — confirm table names via the models'
  # __tablename__ (DatasetSplit at models.py:1486, DatasetSplitDatasetExample at :1512)
  # 1. a split named "regressions" exists on qa-bot-golden
  # 2. its member example ids map exactly to gt["step4"]["expected_example_keys"]
  #    (join through dataset_examples' metadata example_key)
  ```
  Also a negative check: total split count == 1 (the agent didn't spray mutations).
- **All steps additionally report (not gate):** `tool_calls` — count of tool-call parts
  in `/logs/agent/latest/messages.json` — as an extra metric key in `reward.json`.

Optional stretch (skip if time-boxed): replace step 2's keyword check with a
rewardkit LLM judge (binary criterion, https://www.harborframework.com/docs/rewardkit),
passing the judge key via `[verifier.env]`.

**Acceptance criteria:** with hand-crafted correct/incorrect `answer.json` fixtures,
each `check.py` produces 1.0 and 0.0 respectively when run inside the container.

### M6 — Oracle + end-to-end + README

1. `solution/solve.py`: reads `/data/ground_truth.json`, fabricates perfect
   `answer.json`/`answer.md` files into `/logs/agent/steps/N` (and, for step 4, performs
   the split INSERT directly via sqlite so the DB check passes), maintaining the same
   counter/symlink contract as the adapter. `solve.sh` invokes it. This validates the
   verifier plumbing end-to-end (known limitation: it does not prove GraphQL
   derivability — the M2 real-model smoke covers that for step 1).
2. Run the oracle through harbor (check `harbor run --help` for how to run the
   solution/oracle agent) → trial reward must be **1.0**.
3. Run the real agent 3 times:
   `harbor run -p ... --agent ...:PhoenixServerAgent -m anthropic/claude-sonnet-4-5`.
   Record rewards. Any infrastructure failure (not a wrong answer) is a bug — fix it.
4. Write `evals/harbor/README.md`: prerequisites (docker, harbor install command,
   `ANTHROPIC_API_KEY`), the wheel-prep step, the run commands, how to read results,
   and the M1–M5 file map.

**Definition of done:** oracle trial scores 1.0; three real-model trials complete without
infrastructure errors; README lets a newcomer reproduce both.

---

## 5. Step instructions (use these verbatim as `instruction.md`, adjust only if the
answer-contract keys must change)

Every instruction ends with the same closing paragraph:

> End your reply with exactly one fenced ```json code block matching the schema above.
> Do not include any other fenced json blocks in your reply.

**01-aggregate/instruction.md**

```markdown
The Phoenix database contains a dataset named `qa-bot-golden` with two experiments.

Using the tools available to you, find both experiments and compute each experiment's
mean `correctness` score across all of its runs (the score is recorded as an experiment
run annotation named "correctness"). Identify which experiment has the LOWER mean.

Answer schema:
{"lower_experiment": "<experiment name>",
 "means": {"<experiment name>": <mean, 3 decimal places>, "<experiment name>": <mean>}}
```

**02-diagnose/instruction.md**

```markdown
The dataset `qa-bot-golden` has two experiments: `baseline-gpt4o` and `candidate-v2`.

Find every dataset example where the baseline passed (correctness score 1) but the
candidate failed (correctness score 0). Each dataset example has an `example_key` field
in its metadata — report those keys. Then state, in one sentence, what the regressed
examples' inputs have in common.

Answer schema:
{"regressed_example_keys": ["ex-...", ...], "pattern": "<one sentence>"}
```

**03-trace-drilldown/instruction.md**

```markdown
In dataset `qa-bot-golden`, find the example whose metadata `example_key` is "ex-014".
Locate the `candidate-v2` experiment run for that example, find that run's trace, and
identify the span in that trace that errored.

Answer schema:
{"span_name": "<name of the errored span>",
 "exception_message": "<the exception message recorded on that span>"}
```

**04-create-split/instruction.md**

```markdown
In dataset `qa-bot-golden`, determine the examples where `candidate-v2` regressed
relative to `baseline-gpt4o` (baseline correctness score 1, candidate correctness
score 0). Then create a dataset split named "regressions" on `qa-bot-golden` containing
exactly those examples. GraphQL mutations are enabled for this task.

Answer schema:
{"split_name": "regressions", "example_keys": ["ex-...", ...]}
```

`04-create-split/workdir/step-config.json` = `{"allow_mutations": true}`; the other three
steps' `step-config.json` = `{"allow_mutations": false}`.

---

## 6. Pitfalls (each of these will bite if ignored)

1. **Ground truth must never leak.** No seeded string may contain an answer
   ("regression", "spanish" as a label, the span name in an example, etc.). The Spanish
   questions are just… questions in Spanish.
2. **Determinism**: any `datetime.now()`/`random` in the seeder breaks reproducibility
   and the baked-image / ground-truth correspondence. Grep the finished seeder for both.
3. **The runner must mirror `build_server_agent`'s production defaults.** Do not pass
   custom prompts and do not enable subagents/web access/docs MCP — the route
   (`src/phoenix/server/api/routers/agents.py:1048`) is the reference for which knobs
   production uses. If `build_server_agent`'s signature changes, the runner should break
   loudly, not silently diverge.
4. **Docker build context is `environment/` only** — hence the wheel + file-copy prep
   step. Don't try `COPY ../../..`.
5. **`asgi-lifespan` is a test-only dependency** in the repo; the container must
   pip-install it explicitly.
6. **Verify harbor specifics from the installed package, not assumptions**: BaseAgent
   signatures, `AgentContext` fields, per-step tests staging, oracle invocation, model
   flag format. Anything this plan marks VERIFY.
7. **SQLite URL forms differ between sync `sqlite3` (verifiers) and async engine
   (seeder/runner)**. The seeder/runner should use the same helper
   (`phoenix.db.engines.create_engine` / `get_async_db_url`) — do not hand-build
   `sqlite+aiosqlite://` URLs.
8. **Judge nothing you can check with code.** Only step 2's `pattern` sentence is fuzzy,
   and a keyword check gates it for the POC.
9. **If a real-model run fails a step, diagnose in this order**: (a) is the data
   reachable via `phoenix-gql` queries a human could write? (b) is the instruction
   ambiguous? (c) only then consider the agent genuinely failing — that's signal, not a
   harness bug.
