# Phoenix ServerAgent Harbor evaluation

This proof of concept runs Phoenix's production `ServerAgent` through four sequential
regression-triage tasks against a deterministic SQLite database. Programmatic verifiers
score aggregation, diagnosis, trace inspection, and read the GraphQL mutation back through
Phoenix's REST API.

## Prerequisites

- Docker
- `uv tool install harbor`
- An `ANTHROPIC_API_KEY` for real-agent trials

## Prepare and run

From the repository root, build Phoenix and stage the wheel and runner in Harbor's
Docker build context:

```bash
./evals/harbor/prepare.sh
```

Validate the task with the bundled oracle:

```bash
harbor run -p evals/harbor/tasks/regression-triage -a oracle
```

Run the real ServerAgent adapter (`PYTHONPATH` makes the adapter importable from
Harbor's own virtualenv):

```bash
PYTHONPATH=. harbor run -p evals/harbor/tasks/regression-triage \
  -a evals.harbor.agents.phoenix_server_agent:PhoenixServerAgent \
  -m anthropic/claude-sonnet-4-5
```

Harbor stores agent artifacts under each trial's `logs/agent/steps/` directory and
verifier metrics under `logs/verifier/`. The oracle should receive a mean reward of 1.0.

## Seed data

On the first step, `environment/bootstrap_data.sh` downloads the task's `phoenix.db`
and `ground_truth.json` into the container-local `/data` directory from the publicly
readable `gs://arize-phoenix-assets/evals/harbor/<task-name>/` prefix, and fails fast
if the artifacts are missing. Downloading at runtime (rather than bind-mounting from
the host) keeps trials identical across local Docker and cloud backends like Daytona,
where host bind mounts have nothing to bind to.

To publish fresh artifacts:

```bash
./evals/harbor/push_seed_assets.sh
```

The script regenerates each task's `phoenix.db` and `ground_truth.json` from
`environment/seed_db.py`, clears the `evals/harbor` prefix in the bucket, and uploads
the fresh artifacts (with `Cache-Control: no-store`, so re-pushes are visible
immediately) along with a `metadata.json` recording the source commit. Because the
runner opens the database with `migrate=False`, re-run the script whenever
`seed_db.py` or the Phoenix migrations change.

## Layout

- `environment/seed_db.py` creates the deterministic datasets, experiments, and traces.
- `environment/bootstrap_data.sh` downloads the seed artifacts from cloud storage
  into `/data` on the first step.
- `push_seed_assets.sh` publishes each task's seed artifacts to cloud storage.
- `runner/run_server_agent.py` constructs Phoenix's in-process agent, resumes the
  conversation from the previous step's transcript, and captures output. `prepare.sh`
  stages it in the task's generated Docker build context.
- `agents/phoenix_server_agent.py` adapts the runner to Harbor's external-agent API.
- `steps/` contains instructions, mutation configuration, and deterministic verifiers.
- `solution/` is the perfect-answer oracle used to validate verifier plumbing.
