# Phoenix ServerAgent Harbor evaluation

## Prerequisites

- Docker
- `uv tool install harbor`
- An API key for the provider you pass via `-m` (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`)

## Run

Build Phoenix and stage the wheel and runner (from the repository root):

```bash
./evals/harbor/prepare.sh
```

Validate with the bundled oracle:

```bash
harbor run -p evals/harbor/tasks/regression-triage -a oracle
```

Run the real ServerAgent adapter:

```bash
PYTHONPATH=. harbor run -p evals/harbor/tasks/regression-triage \
  -a evals.harbor.agents.phoenix_server_agent:PhoenixServerAgent \
  -m anthropic/claude-sonnet-4-5
```

Optionally export traces to a remote Phoenix instance:

```bash
export HARBOR_PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.example.com
export HARBOR_PHOENIX_API_KEY=...
export HARBOR_PHOENIX_PROJECT_NAME=harbor-server-agent-evals
```

## Publish seed data

```bash
./evals/harbor/push_seed_assets.sh
```
