# Agent skill regression coverage

[skill_coverage.yaml](skill_coverage.yaml) maps every built-in skill to positive,
boundary, and outcome checks for [#16512](https://github.com/Arize-ai/phoenix/issues/16512).
Contract tests compare it with the shipped skill directories.

## Architecture

The remote `/mcp` server loads `src/phoenix/server/mcp/skills/`. PXI loads those
shared skills plus `src/phoenix/server/agents/prompts/skills/`. Agents call
`load_skill` and `load_skill_reference`; the shared skill currently has no separate
references. The new cases test automatic selection without preloading a skill.
Deployment-specific `PHOENIX_SKILLS_PATHS` entries are outside this inventory.

The Claude plugin separately ships `phoenix-cli`, `phoenix-tracing`, and
`phoenix-evals` from `.agents/skills/`, and connects to remote MCP. Plugin evals
test selection, instruction following, and returned artifacts with fixed mocks.
They do not prove that database writes persist.

Harbor runs PXI against a real Phoenix server and fresh SQLite database. The
compiler turns YAML examples into tasks. `PxiEvalAgent` seeds each session and
runs a chat turn; Reward Kit invokes the existing Phoenix evaluator registry.
The Harbor Phoenix plugin records trials and reward dimensions as experiments.
An existing two-step error-analysis task checks persisted notes, annotation
configs, labels, and local sidecars.

## Coverage inventory

The new [Harbor datasets](harbor/pxi/datasets) contain 12 cases: five positives
in `skill_artifacts`, six negatives in `skill_boundaries`, plus one positive in
`graphql_skill_artifact`. They are hand-authored and await cross-model annotation
review and credentialed baseline runs.

| Skill | Surface | Existing coverage | Harness | Positive | Boundary | Outcome | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| datasets | PXI | Product knowledge/workflow cases | Harbor | Review output provenance and prompt binding | Prompt-only editing | Complete JSON review | Persisted dataset mutation |
| evaluators | PXI | `evaluators_skill_trigger` | Harbor | Design an empty-output evaluator | Read an existing score | Kind, labels, direction, preview scores | Execute generated evaluator code |
| experiments | PXI | Product knowledge/browser actions | Harbor | Compare a two-row baseline and candidate | Draft a prompt | Regressed row, quality, latency, cost | Persisted experiment creation |
| playground | PXI | `playground_prompt_rewrite` | Harbor | Rewrite preserving bindings | Dataset provenance | Exact message artifact | Applied browser state |
| phoenix-graphql | PXI | Tool/schema tests | Harbor | Generate paginated project query | Local Python transformation | Validate SDL, fields, cursor, page size | Execute against seeded projects |
| phoenix-error-analysis | Both | Stateful open/axial coding | Harbor + plugin | Review unit and phase order; four MCP planning cases | Count; arithmetic; Elixir request | JSON plan, response claims, existing persisted-state checks | Repeated baseline on both surfaces |
| phoenix-cli | Claude plugin | Imported eight-case suite | Plugin | Six trace diagnosis/script cases | Elixir and unrelated agent | CLI, artifact, diagnosis graders | Revalidate imported baseline |
| phoenix-evals | Claude plugin | New eight-case suite | Plugin | Code/judge design, validation, provenance, binding, CI | JSON parsing and SQL aggregation | API patterns and separate behavior claims | Credentialed calibration; coordinate assignee |
| phoenix-tracing | Claude plugin | New eight-case suite | Plugin | Python/TS setup, retriever, context, privacy, flush | Elixir and Python exception | Instrumentation patterns and separate claims | Credentialed calibration; coordinate assignee |

The eight-case MCP suite also tests project discovery and lookup through
`get_schema` and `execute`, checking returned project names and ID. Its fixture
accepts one default-argument `getProjects` call and rejects other operations.
It tests that workflow, not general code-mode execution.

## Run and report

Use Python 3.13 for the Harbor compiler and install its supplemental test tools:

```sh
uv sync --frozen --python 3.13
uv pip install --override evals/harbor/environments/overrides.txt 'harbor==0.21.0' 'harbor-rewardkit==0.2.1'
UV_NO_SYNC=true make skill-evals-test
make skill-evals-capture-mcp
```

`UV_NO_SYNC` keeps the supplemental Harbor tools installed for this command
without changing the repository lockfile.

To verify experiment ingestion, start a disposable Phoenix server and run:

```sh
SKILL_EVALS_TEST_ENDPOINT=http://localhost:6006 make skill-evals-reporting-test
```

This integration test writes synthetic reporting records and reads them back
through Phoenix APIs. It verifies both arms, repetitions, errors, named grades,
and stable example IDs across imports. It makes no model calls and does not
establish an agent baseline. Use a disposable server because it writes to the
same stable suite dataset names as the real reporter.

Capture uses the production MCP builder, checked-in OpenAPI schema, and shared
skill files. It calls `tools/list`, `load_skill`, and discovery without accessing
a database. Review and commit refreshed mocks alongside their source changes.

Prepare and run the new PXI cases:

```sh
HARBOR_PXI_ARGS="--datasets skill_artifacts skill_boundaries graphql_skill_artifact --splits regression" HARBOR_CLI=0 make harbor-prepare
make harbor-run HARBOR_JOB=evals/harbor/jobs/pxi.yaml
uv run python -m evals.skill_regression harbor
```

The job uses Daytona and OpenAI credentials. Harbor also supports Docker via its
environment override. Preparation builds the Phoenix wheel and environments.
The existing error-analysis task additionally needs its published fixture and
judge credentials. Job YAML and task TOML define models and network allowlists.

From `plugins/claude/arize-phoenix`, run a plugin suite:

```sh
claude plugin eval . --case 'tracing-*' --runs 3 --ablation with-without \
  --model claude-sonnet-5 --judge-model claude-sonnet-5 --threshold 0.8 \
  --allow-tools Write "Read(//$(pwd)/**)" "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)" \
  --json evals/results/tracing.json --no-publish --max-cost-usd 25
```

Use `evals-*`, `mcp-*`, or `0*` for the other suites. Run the gate at repository root:

```sh
uv run python -m evals.skill_regression plugin \
  plugins/claude/arize-phoenix/evals/results/tracing.json --suite tracing --model claude-sonnet-5
```

With `PHOENIX_COLLECTOR_ENDPOINT` and optional `PHOENIX_API_KEY` configured,
`python -m evals.report_plugin_experiment <result.json> --suite tracing --model <model>`
imports completed results without rerunning models. Stable example UUIDs preserve
case identity. Separate experiments retain both arms, repetitions, errors, named
grader results, and whether ablation scored each grader. Full transcripts and
artifacts remain in the uploaded Claude results directory.

## Regression policy

Both harnesses use three attempts. The new gate requires at least two passes in
three for every grader of every skill case. Plugin cases also retain the existing
0.8 weighted-score floor. Activation indicators are checked even when Claude
excludes them from its ablation score. Missing or errored runs cannot establish
a passing result. Failure lines name harness, skill, case, model, and grader;
PXI verifier logs also retain structured grader explanations and metadata.

PXI CI retains its overall 0.9 reward gate and adds per-case checks for the new
skill tasks. Plugin CI runs four separate suites and reports to Phoenix when
configured. Fork plugin jobs skip because secrets are unavailable. Deterministic
unit and contract tests run in a separate CI job, including on forks, and need
no paid APIs. Plugin gates compare report prompts and grader definitions with
the checkout, so stale reports cannot silently omit a check. Harbor gates read
the saved job configuration and require the planned trials for every task and
model; a missing model's results cannot disappear into the suite average.

Only the imported CLI suite has a measured uplift baseline and a 0.15 delta
floor. Other suites report delta without claiming a calibrated threshold.
Their pass-rate floors are initial acceptance policy, not measured baselines.
Before setting a baseline, run at least three complete jobs with fixed models,
dependencies, fixtures, and case IDs. Inspect misses, retain reports, and agree
thresholds with maintainers. Model or fixture changes require recalibration.

## Completion evidence

The inventory and committed cases cover the issue's positive, boundary, and
outcome requirements. The remaining gaps in the table describe possible deeper
workflow coverage; the issue does not require every skill to mutate server or
browser state. Existing stateful error-analysis tasks use the Harbor environment.

Before claiming #16512 or its related issues complete, retain successful repeated
agent reports for all suites, publish those results to Phoenix, and record the
measured baselines and their model/fixture provenance. The PXI examples also need
the independent annotation review prescribed by the dataset authoring skill.
These are pending external validation, not passes inferred from unit tests.

## Add coverage

1. Use plugin evals for selection, instructions, and artifacts; use Harbor for
   real servers, persistent state, and multiple turns.
2. Add positive, boundary, and outcome cases with stable IDs. Keep skills
   available but unloaded for automatic-trigger cases.
3. Reuse the evaluator registry. New graders need rejection tests and a Reward
   Kit adapter. Check final effects, not just tool names.
4. Update `skill_coverage.yaml` and run the contract tests.
5. Run repeated live evaluations. Record baseline provenance and pending reviews.

Dependencies come from PRs [#16342](https://github.com/Arize-ai/phoenix/pull/16342)
and [#16223](https://github.com/Arize-ai/phoenix/pull/16223), addressing
[#16341](https://github.com/Arize-ai/phoenix/issues/16341) and part of
[#16170](https://github.com/Arize-ai/phoenix/issues/16170).
Remote MCP coverage is tracked by [#16184](https://github.com/Arize-ai/phoenix/issues/16184).
Coordinate tracing/evals work with the assignee of #16294/#16293 before submitting
overlapping contributions. This coverage does not claim the whole epic.
