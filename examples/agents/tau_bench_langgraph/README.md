# tau-bench + LangGraph

A customer service agent built with LangGraph, instrumented with OpenInference, running tau-bench retail domain tasks. This is the LangGraph counterpart to the [OpenAI Agents SDK implementation](../tau_bench_openai_agents/README.md) — same tools, same database, same simulated user, different framework. Comparing traces between the two reveals how framework choice affects what trajectory information is available.

## What This Does

Runs the same retail customer service agent through the same tau-bench tasks as the OpenAI Agents SDK version. The agent authenticates users, looks up orders, and executes mutations (cancellations, returns, exchanges, modifications) using 16 tools — all traced to Phoenix.

## Architecture

```
Simulated User (not traced)          Agent Framework (traced)
+---------------------+    msg    +------------------------------+
| LLMUserSimulationEnv | -------> | LangGraph StateGraph         |
| (litellm/gpt-4o)    | <------- |   "agent" node (ChatOpenAI)  |
+---------------------+  response |   "tools" node (ToolNode)    |
                                  |   conditional routing        |
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

The agent is a `StateGraph(MessagesState)` with two nodes:
- **"agent"** — calls `ChatOpenAI` with the full message history and bound tools
- **"tools"** — executes tool calls via `ToolNode`

Conditional routing loops between agent → tools until the LLM produces a response with no tool calls, then routes to END.

Each outer turn (user message → agent response, potentially with multiple internal tool-call loops) produces a span tree:

```
conversation.turn (manual)              ← wraps the full turn
  LangGraph (auto)                      ← graph execution
    ChatOpenAI (auto, LLM)              ← LLM call with message history
    <tool_name> (auto, TOOL)            ← tool execution (if any)
    ChatOpenAI (auto, LLM)              ← follow-up LLM call
```

### Key differences from the OpenAI Agents SDK version

- **Span nesting**: LangGraph produces a flatter span tree — LLM and TOOL spans are siblings under the graph span, rather than nested under agent workflow spans.
- **Message accumulation**: LangGraph's `MessagesState` carries the full conversation history forward, so later LLM spans contain all prior messages. Token usage scales with conversation length.
- **Turn boundaries**: Both implementations use a manual `conversation.turn` span to group each turn, but the internal structure differs.

## Usage

From the `examples/agents/` directory:

```bash
# Run all 10 selected tasks
python -m tau_bench_langgraph

# Run specific tasks
python -m tau_bench_langgraph --tasks dev:0 dev:12

# Run without Phoenix
python -m tau_bench_langgraph --no-phoenix
```

## File Structure

| File | Purpose |
|------|---------|
| `agent.py` | LangGraph `StateGraph` definition and multi-turn conversation loop |
| `tools.py` | 16 retail tools as LangChain `@tool` functions wrapping tau-bench `Tool.invoke()` |
| `db.py` | In-memory DB loader; deep-copies tau-bench JSON data per task |
| `user_sim.py` | Simulated user wrapper (same as OpenAI Agents SDK version) |
| `phoenix_setup.py` | OpenInference `LangChainInstrumentor` + Phoenix OTLP setup |
| `tasks.py` / `tasks_scaled.py` | Task selection from tau-bench dev/train splits |
| `run.py` | CLI entry point |
