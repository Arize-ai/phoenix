# Phoenix ServerAgent Harbor evaluation

This proof of concept runs Phoenix's production `ServerAgent` through four sequential
regression-triage tasks against a deterministic SQLite database. Programmatic verifiers
score aggregation, diagnosis, trace inspection, and a GraphQL mutation.

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

Run the real ServerAgent adapter:

```bash
harbor run -p evals/harbor/tasks/regression-triage \
  -a evals.harbor.agents.phoenix_server_agent:PhoenixServerAgent \
  -m anthropic/claude-sonnet-4-5
```

Harbor stores agent artifacts under each trial's `logs/agent/steps/` directory and
verifier metrics under `logs/verifier/`. The oracle should receive a mean reward of 1.0.

## Layout

- `environment/seed_db.py` creates the deterministic datasets, experiments, and traces.
- `runner/run_server_agent.py` constructs Phoenix's in-process agent and captures output.
- `agents/phoenix_server_agent.py` adapts the runner to Harbor's external-agent API.
- `steps/` contains instructions, mutation configuration, and deterministic verifiers.
- `solution/` is the perfect-answer oracle used to validate verifier plumbing.

The checked-in `PLAN.md` documents the scenario and expected behavior in detail.
