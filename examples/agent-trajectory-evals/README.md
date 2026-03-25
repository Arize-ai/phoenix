# Agent Trajectory Evals

Evaluate AI agent trajectories by comparing actual tool-call sequences against ground-truth benchmarks, then surface failure modes in Phoenix.

This example runs the same customer-service tasks on **three agent implementations**, performs deterministic trajectory comparison, LLM-powered error analysis, and writes structured evaluation annotations back to Phoenix traces.

## What's Inside

### Agent implementations

| Implementation | Framework | Benchmark | Description |
|---|---|---|---|
| `tau_bench_openai_agents/` | OpenAI Agents SDK | [tau-bench](https://github.com/sierra-research/tau-bench) | Multi-turn retail customer service agent |
| `tau_bench_langgraph/` | LangGraph | tau-bench | Same tasks, different framework |
| `traject_bench_langgraph/` | LangGraph | [TRAJECT-Bench](https://huggingface.co/datasets/Jnnamchi/traject-bench) | Single-turn parallel & sequential tool-calling tasks |

### Evaluation pipeline

| Script | Purpose |
|---|---|
| `run_scaled.py` | Orchestrate batch runs across all implementations (20 tasks each) |
| `compare_trajectories.py` | Deterministic comparison: tool selection (precision/recall/F1), parameter accuracy, ordering |
| `analyze_errors.py` | LLM-powered error analysis using Claude — classifies failure modes and synthesizes findings |
| `extract_traces.py` | Extract trajectories from Phoenix traces or saved result files |
| `annotate_traces.py` | Write structured evaluation scores back to Phoenix trace annotations |

### Evaluation dimensions

The pipeline evaluates eight dimensions per task, written as Phoenix span annotations:

| Annotation | Values | What it measures |
|---|---|---|
| `task_completion` | 0.0 / 0.5 / 1.0 | Did the agent complete the task? |
| `tool_selection_correct` | 0.0–1.0 | Were the expected mutation tools called? |
| `unnecessary_escalation` | 0 / 1 | Did the agent escalate when it shouldn't have? |
| `parameter_accuracy` | 0.0–1.0 | Were tool arguments correct? |
| `trajectory_efficiency` | 0.0–1.0 | Ratio of minimum required calls to actual calls |
| `tool_error_handling` | 0 / 1 | Did the agent recover from tool errors? |
| `policy_compliance` | 0.0–1.0 | Were domain-specific rules followed? |
| `compounding_errors` | 0 / 1 | Did a single error cascade into complete failure? |

## Prerequisites

- Python 3.10+
- `OPENAI_API_KEY` environment variable
- `ANTHROPIC_API_KEY` environment variable (for `analyze_errors.py`)
- Phoenix running locally (`phoenix serve` or Docker) for trace collection and annotation

## Setup

```bash
cd examples/agent-trajectory-evals
pip install -r requirements.txt

# Start Phoenix
phoenix serve
```

## Running the Example

### 1. Run agent tasks with tracing

```bash
# Run all three implementations (20 tasks each, ~10 min):
python -m run_scaled

# Run specific implementations:
python -m run_scaled --implementations tau-openai tau-langgraph

# Run without Phoenix tracing:
python -m run_scaled --no-phoenix
```

Results are saved to `results/scaled/` as JSON files.

### 2. Compare trajectories (deterministic)

```bash
python -m compare_trajectories \
  --results results/scaled/tau_openai_*.json \
             results/scaled/tau_langgraph_*.json \
             results/scaled/traject_langgraph_*.json
```

Computes per-task tool selection precision/recall/F1, parameter accuracy, and ordering correctness.

### 3. Analyze errors with Claude

```bash
python -m analyze_errors \
  --results results/scaled/tau_openai_*.json \
            results/scaled/tau_langgraph_*.json \
            results/scaled/traject_langgraph_*.json \
  --comparison results/scaled/comparison_*.json
```

Each task trajectory is analyzed by Claude for failure modes, root causes, and severity. A synthesis report identifies cross-framework and cross-benchmark patterns.

### 4. Annotate Phoenix traces

```bash
python -m annotate_traces
```

Writes all eight evaluation scores as annotations on Phoenix root spans. View them in the Phoenix UI at http://localhost:6006.

### 5. Extract trajectories from Phoenix

```bash
# From live Phoenix:
python -m extract_traces

# From saved results:
python -m extract_traces --from-results results/scaled/*.json
```

## Key Findings (from 60-task evaluation)

- **47% clean success**, 27% suboptimal, 27% catastrophic failure
- **Compounding error cascades** are the dominant failure pattern: tool error -> think() -> escalate -> all mutations skipped (56% of catastrophic failures)
- **LangGraph outperforms OpenAI Agents SDK** on the same tasks (70% vs 55% completion) — more persistent error recovery
- **tau-bench is much harder** than TRAJECT-Bench (37.5% vs 5% catastrophic rate) due to multi-turn conversation management

## Architecture

```
run_scaled.py
  ├── tau_bench_openai_agents/   ← OpenAI Agents SDK + user simulator
  ├── tau_bench_langgraph/       ← LangGraph + user simulator
  └── traject_bench_langgraph/   ← LangGraph single-turn

compare_trajectories.py          ← Deterministic tool-call comparison
analyze_errors.py                ← LLM-powered failure mode analysis
annotate_traces.py               ← Write scores to Phoenix annotations
extract_traces.py                ← Pull trajectories from Phoenix/results
```

Each agent implementation has:
- `agent.py` — Agent definition and conversation runner
- `tools.py` — Tool definitions matching the benchmark's expected API
- `tasks.py` / `tasks_scaled.py` — Task loading from benchmark datasets
- `phoenix_setup.py` — OpenTelemetry + Phoenix instrumentation setup
- `db.py` — In-memory database for tau-bench (retail domain state)
- `user_sim.py` — User simulator for tau-bench multi-turn conversations
