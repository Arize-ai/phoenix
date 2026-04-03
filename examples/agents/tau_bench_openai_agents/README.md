# tau-bench + OpenAI Agents SDK

A customer service agent built with the OpenAI Agents SDK, instrumented with OpenInference, running tau-bench retail domain tasks. This is part of the trajectory evaluation investigation — examining what OTel traces capture when an agent framework naturally handles tool-calling conversations.

## What This Does

Runs a retail customer service agent through 10 selected tau-bench tasks. The agent:
- Authenticates users (by email or name+zip)
- Looks up orders, products, and user profiles
- Cancels, modifies, returns, and exchanges orders
- Follows a detailed retail policy (wiki.md)

All agent activity (LLM calls, tool executions) is automatically traced via OpenInference and exported to Phoenix.

## Architecture

```
Simulated User (not traced)          Agent Framework (traced)
+---------------------+    msg    +------------------------------+
| LLMUserSimulationEnv | -------> | OpenAI Agents SDK            |
| (litellm/gpt-4o)    | <------- |   Agent + 16 @function_tools |
+---------------------+  response |   | LLM spans               |
                                  |   | TOOL spans               |
                                  +------------------------------+
                                           | OTel/OTLP
                                           v
                                  +------------------+
                                  | Phoenix (local)   |
                                  | http://localhost:  |
                                  | 6006               |
                                  +------------------+
```

The outer multi-turn loop (`agent.py`) passes messages between the simulated user and the agent framework. Only the agent framework is instrumented — the simulated user (which stands in for a real human) is not traced, matching what production instrumentation would look like.

Each call to `Runner.run()` is one "agent turn": the SDK handles LLM call -> tool calls (if any) -> final text response. OpenInference auto-instruments all of this, producing a span tree per turn:

```
conversation.turn (manual, AGENT)       <- wraps the full turn
  Agent workflow (auto, AGENT)          <- SDK orchestration
    RetailAgent (auto, AGENT)           <- agent node
      response (auto, LLM)             <- LLM call with full message history
      <tool_name> (auto, TOOL)         <- tool execution (if any)
      response (auto, LLM)             <- follow-up LLM call (if tool was called)
```

## Setup

### Prerequisites

- Python 3.10+
- `OPENAI_API_KEY` environment variable set
- Phoenix running locally (`python -m phoenix.server.main serve`)

### Install Dependencies

```bash
pip install openai-agents openinference-instrumentation-openai-agents arize-phoenix litellm openai
```

## Usage

From the `examples/agents/` directory:

```bash
# Run all 10 selected tasks
python -m tau_bench_openai_agents.run

# Run specific tasks by label (split:index format)
python -m tau_bench_openai_agents.run --tasks dev:0 dev:12 train:35

# Run without Phoenix (no trace export)
python -m tau_bench_openai_agents.run --no-phoenix

# Save results to a specific path
python -m tau_bench_openai_agents.run --output results.json
```

By default results are saved to `results/tau_bench_openai_agents_<timestamp>.json`.

## Selected Tasks

Tasks are drawn from the **dev** and **train** splits (not test, which is held out). All splits have full ground truth tool sequences (`actions` with `name` and `kwargs`).

| Task ID | Category | Summary | Expected Actions |
|---------|----------|---------|-----------------|
| dev:0 | Single cancel | Cancel pending order, name+zip auth | 1 (cancel) |
| dev:1 | Single exchange | Exchange delivered items, email auth | 1 (exchange) |
| dev:6 | Auth edge case | Multiple emails, user unsure which | 1 (cancel) |
| dev:9 | Single modify | Modify pending order items | 1 (modify items) |
| dev:12 | Complex multi-modify | 3 orders: payment + item modify each | 6 (3x payment + items) |
| dev:14 | Multi-step | Address change + item modify, same order | 2 (address + items) |
| dev:15 | Policy boundary | Argumentative user, out-of-scope then cancel | 1 (cancel) |
| dev:17 | Zero-action | User complains, nothing actionable | 0 |
| train:35 | Multi-type | address + items + return + exchange | 4 |
| train:351 | Complex multi-type | cancel + exchange + payment + items + return + address | 7 |

## File Structure

| File | Purpose |
|------|---------|
| `agent.py` | Agent definition (`create_agent()`) and multi-turn conversation loop (`run_conversation()`) |
| `tools.py` | 16 retail tools as `@function_tool` functions; each delegates to tau-bench `Tool.invoke()` via a shared module-level `_data` dict |
| `db.py` | In-memory DB loader; deep-copies tau-bench JSON data per task so mutations are isolated |
| `user_sim.py` | Wrapper around tau-bench's `LLMUserSimulationEnv` with deferred init (avoids the eager LLM call in `__init__`) |
| `phoenix_setup.py` | OpenInference instrumentation + Phoenix OTLP connection |
| `tasks.py` | Task selection from dev/train splits |
| `run.py` | CLI entry point |

## How It Works

### Tool Integration

Tools are registered as native `@function_tool` decorated functions (`tools.py`). Each wraps a tau-bench `Tool` class, delegating to its `invoke()` method. The shared database (`_data` dict) is set at module level before each task via `set_data()`. The OpenAI Agents SDK auto-generates tool schemas from the function signatures and docstrings — these match what tau-bench's `get_info()` returns.

### Multi-Turn Loop

The conversation loop in `agent.py` is the outer orchestrator:

1. Load fresh DB copy for this task (`load_data()` deep-copies)
2. Initialize simulated user with task instruction, get first message
3. For each turn:
   - Call `Runner.run(agent, input)` — the SDK handles LLM + tool execution
   - Extract agent's text response from `run_result.final_output`
   - Check for terminal tool calls (`transfer_to_human_agents`)
   - Pass response to simulated user, get next message
   - Build next input via `run_result.to_input_list()` + new user message
4. Terminate on `###STOP###` (user satisfied), terminal tool call, or max turns

### Phoenix Instrumentation

`phoenix_setup.py` configures:
- A `TracerProvider` with `Resource` tagged with project name (`tau-bench-openai`)
- OTLP exporter pointing at local Phoenix
- Sets the global tracer provider so both auto-instrumented and manual spans share it
- `OpenAIAgentsInstrumentor` for automatic LLM/TOOL span capture

`agent.py` adds manual instrumentation on top:
- `using_attributes()` context manager propagates `session_id`, `user_id`, `metadata`, and `tags` to all child spans within a turn
- A `conversation.turn` span wraps each turn with `input.value` (user message) and `output.value` (agent response), giving Phoenix Sessions readable HUMAN/AI timelines

### Simulated User

`user_sim.py` wraps tau-bench's `LLMUserSimulationEnv` with deferred construction. The original class calls `self.reset()` in `__init__` (triggering an LLM call with no instruction). The wrapper uses `object.__new__()` to construct without calling `__init__`, then manually sets the required fields before calling `reset(instruction)`.

## Key Design Decisions

1. **Full framework integration** — tools are native `@function_tool`, not adapters. The SDK executes them, producing real LLM + TOOL spans. We are NOT using tau-bench's `Env.step()`.
2. **Simulated user outside instrumentation** — production wouldn't trace the user.
3. **DB state not traced** — a production app wouldn't trace database mutations through OTel. If trajectory evaluation needs DB state changes, that's a finding about what traces don't capture.
4. **`parallel_tool_calls=False`** — matches tau-bench's single-tool-per-turn policy from wiki.md.
5. **Temperature 0, gpt-4o** — for reproducibility, matching tau-bench's evaluation setup.
6. **Dev/train splits only** — test is held out. Ground truth (tool sequences with exact args) is fully present in all splits.
