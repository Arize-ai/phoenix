# Agents

Example agent implementations instrumented with [OpenInference](https://github.com/Arize-ai/openinference) and traced to [Phoenix](https://github.com/Arize-ai/phoenix). Each example runs benchmark tasks through an agent framework, producing rich traces with LLM calls, tool executions, and multi-turn conversation flows.

## What's Inside

### Agent implementations

| Implementation | Framework | Benchmark | Description |
|---|---|---|---|
| `tau_bench_openai_agents/` | OpenAI Agents SDK | [tau-bench](https://github.com/sierra-research/tau-bench) | Multi-turn retail customer service agent with 16 tools, user simulation, and policy enforcement |
| `tau_bench_langgraph/` | LangGraph | tau-bench | Same retail tasks on a different framework for comparison |
| `traject_bench_langgraph/` | LangGraph | [TRAJECT-Bench](https://huggingface.co/datasets/Jnnamchi/traject-bench) | Single-turn parallel and sequential tool-calling tasks across multiple domains |

### Orchestration

| Script | Purpose |
|---|---|
| `run_scaled.py` | Run batch tasks across all implementations with Phoenix tracing |

## Prerequisites

- Python 3.10+
- `OPENAI_API_KEY` environment variable
- Phoenix running locally (`phoenix serve` or Docker) for trace collection

## Setup

```bash
cd examples/agents

# Option 1: pip
pip install -r requirements.txt

# Option 2: uv (recommended)
uv venv --python 3.10
source .venv/bin/activate
uv pip install -r requirements.txt

# Start Phoenix
phoenix serve
```

> **Note**: The tau-bench dependency installs from GitHub (`tau-bench @ git+https://...`). The TRAJECT-Bench dataset downloads from HuggingFace on first run (~small, cached afterward).

## Running the Examples

### Run all implementations

```bash
# Run all three implementations (20 tasks each, ~10 min):
python -m run_scaled

# Run specific implementations:
python -m run_scaled --implementations tau-openai tau-langgraph

# Run without Phoenix tracing:
python -m run_scaled --no-phoenix
```

Results are saved to `results/scaled/` as JSON files. Traces are exported to Phoenix at http://localhost:6006.


### Run a single implementation directly

```bash
# tau-bench with OpenAI Agents SDK
python -m tau_bench_openai_agents.run

# tau-bench with LangGraph
python -m tau_bench_langgraph

# TRAJECT-Bench with LangGraph
python -m traject_bench_langgraph
```

## Architecture

```
run_scaled.py
  ├── tau_bench_openai_agents/   ← OpenAI Agents SDK + user simulator
  ├── tau_bench_langgraph/       ← LangGraph + user simulator
  └── traject_bench_langgraph/   ← LangGraph single-turn
```

Each agent implementation has:
- `agent.py` — Agent definition and conversation runner
- `tools.py` — Tool definitions matching the benchmark's expected API
- `tasks.py` / `tasks_scaled.py` — Task loading from benchmark datasets
- `phoenix_setup.py` — OpenTelemetry + Phoenix instrumentation setup
- `db.py` — In-memory database for tau-bench (retail domain state)
- `user_sim.py` — User simulator for tau-bench multi-turn conversations

### tau-bench agents

The tau-bench agents implement a retail customer service workflow. A simulated user (powered by an LLM) presents requests — cancellations, returns, exchanges, order modifications — and the agent must authenticate the user, look up relevant data, and execute the correct mutations using 16 available tools. The conversation runs for multiple turns until the user is satisfied or the agent escalates.

Both the OpenAI Agents SDK and LangGraph implementations use the same tools, database, and user simulator, differing only in the agent framework. This makes them useful for comparing how framework choice affects trace structure.

### TRAJECT-Bench agent

The TRAJECT-Bench agent handles single-turn tool-calling tasks from the [TRAJECT-Bench dataset](https://huggingface.co/datasets/Jnnamchi/traject-bench). Tasks span multiple domains (e-commerce, travel, finance, music, etc.) and come in two types:
- **Parallel**: Multiple independent tool calls that can execute in any order
- **Sequential**: Tool calls with dependencies where output from one feeds into the next

Tools are dynamically created per task from the dataset's tool definitions, returning pre-recorded outputs when parameters match ground truth.

## Exploring Traces in Phoenix

After running the examples, open Phoenix at http://localhost:6006. Each implementation sends traces to its own project:

| Project name | Implementation |
|---|---|
| `tau-bench-openai` | tau-bench + OpenAI Agents SDK |
| `tau-bench-langgraph` | tau-bench + LangGraph |
| `traject-bench-langgraph` | TRAJECT-Bench + LangGraph |

Things to look at:

- **Traces view** — each trace is one task execution. Expand the span tree to see the LLM → tool call → LLM loop. Compare span nesting between the OpenAI Agents SDK and LangGraph projects.
- **Sessions** — tau-bench traces are grouped by session (one session per task). Each session shows the multi-turn HUMAN/AI conversation timeline.
- **Span details** — click any LLM span to see the full message history, token counts, and model parameters. Click TOOL spans to see the arguments passed and return values.
- **Parallel vs sequential** — in the TRAJECT-Bench project, compare parallel tasks (sibling TOOL spans) with sequential tasks (chained TOOL spans where output feeds into the next call).

<!-- Screenshots: TODO -->
