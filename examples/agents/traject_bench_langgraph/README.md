# TRAJECT-Bench + LangGraph

A single-turn tool-calling agent built with LangGraph, instrumented with OpenInference, running [TRAJECT-Bench](https://huggingface.co/datasets/Jnnamchi/traject-bench) tasks. This contrasts with the tau-bench examples on every dimension: single-turn (not multi-turn), mock tools (not live DB mutations), parallel and sequential tool patterns (not conversational).

## What This Does

Runs an agent through TRAJECT-Bench tasks that test tool selection, parameter accuracy, and execution ordering. Tasks span multiple domains (e-commerce, travel, finance) and come in two types:

- **Parallel**: Multiple independent tool calls that can execute in any order
- **Sequential**: Tool calls with dependencies — output from one feeds into the next

Tools are dynamically created per task from the dataset's definitions, returning pre-recorded outputs when invoked. This isolates the agent's tool-calling behavior from external API variability.

## Architecture

```
                                  Agent Framework (traced)
                                  +------------------------------+
  Task query (single turn) -----> | LangGraph StateGraph         |
                                  |   "agent" node (ChatOpenAI)  |
                                  |   "tools" node (ToolNode)    |
                                  |   parallel_tool_calls=True/  |
                                  |     False per task type      |
                                  |   | LLM spans                |
                                  |   | TOOL spans               |
                                  +------------------------------+
                                           | OTel/OTLP
                                           v
                                  +------------------+
                                  | Phoenix (local)  |
                                  | localhost:6006   |
                                  +------------------+
```

Unlike tau-bench, a **fresh graph is created per task** because each task has different tools. The graph is invoked once with a system prompt (task description + available tool names) and the task query. The agent loops internally (agent → tools → agent) until it produces a final answer.

Span tree for a typical task:

```
LangGraph (auto)                        ← graph execution
  ChatOpenAI (auto, LLM)               ← initial LLM call with system + user message
  <tool_1> (auto, TOOL)                ← first tool call
  <tool_2> (auto, TOOL)                ← second tool call (parallel tasks)
  ChatOpenAI (auto, LLM)               ← follow-up with tool results → final answer
```

### Key differences from the tau-bench examples

- **No conversation loop** — single query in, tool calls, final answer out.
- **Dynamic tools** — mock functions created from dataset definitions per task, not static tool code.
- **Parallel tool calls** — parallel tasks enable `parallel_tool_calls=True`, so the LLM can request multiple tools in one response. This shows up as sibling TOOL spans in the trace.
- **No simulated user** — no external user interaction.

## Usage

From the `examples/agents/` directory:

```bash
# Run all 9 selected tasks
python -m traject_bench_langgraph

# Run specific tasks
python -m traject_bench_langgraph --tasks parallel_simple:0 sequential:1

# Run without Phoenix
python -m traject_bench_langgraph --no-phoenix
```

> **Note**: The first run downloads the TRAJECT-Bench dataset from HuggingFace (~small download). Subsequent runs use the cached version.

## File Structure

| File | Purpose |
|------|---------|
| `agent.py` | Per-task LangGraph `StateGraph` creation and single-turn execution |
| `tools.py` | Dynamic mock tool factory — creates LangChain `@tool` functions from dataset definitions |
| `phoenix_setup.py` | OpenInference `LangChainInstrumentor` + Phoenix OTLP setup |
| `tasks.py` / `tasks_scaled.py` | Task loading from HuggingFace dataset (handles field name inconsistencies) |
| `run.py` | CLI entry point |

## How Mock Tools Work

Each TRAJECT-Bench task defines its tools as JSON: name, description, parameters, and expected output. `tools.py` dynamically creates a LangChain `@tool` function for each:

1. Tool name is sanitized (e.g., `"Wayfair: reviews/list"` → `"wayfair_reviews_list"`)
2. The function accepts a `parameters` dict and returns the pre-recorded `executed_output`
3. Docstrings include the tool description and parameter specs

This means the tools always return the "correct" output — the evaluation focus is on whether the agent calls the right tools with the right parameters in the right order, not on handling real API responses.
