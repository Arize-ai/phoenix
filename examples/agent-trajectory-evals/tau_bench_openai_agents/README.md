# tau-bench + OpenAI Agents SDK

A customer service agent built with the OpenAI Agents SDK, instrumented with OpenInference, running tau-bench retail domain tasks. This is part of the trajectory evaluation investigation — examining what OTel traces capture when an agent framework naturally handles tool-calling conversations.

## What This Does

Runs a retail customer service agent through 10 selected tau-bench tasks. The agent:
- Authenticates users (by email or name+zip)
- Looks up orders, products, and user profiles
- Cancels, modifies, returns, and exchanges orders
- Follows a detailed retail policy (wiki.md)
- Transfers to human agents when appropriate

All agent activity (LLM calls, tool executions) is automatically traced via OpenInference and exported to Phoenix.
Traces are tagged to the Phoenix project `tau-bench-openai`.
Each task conversation uses a stable OpenInference `session.id`, so all turn-level traces for that task appear under one Phoenix Session.
The run loop also emits one lightweight `conversation.turn` span per turn with plain-text `input.value`/`output.value` so Session timelines render readable HUMAN/AI bubbles.

## Architecture

```
Simulated User (not traced)          Agent Framework (traced)
┌─────────────────────┐    msg    ┌──────────────────────────────┐
│ LLMUserSimulationEnv │ ───────> │ OpenAI Agents SDK            │
│ (litellm/gpt-4o)    │ <─────── │   Agent + 16 @function_tools │
└─────────────────────┘  response │   ↕ LLM spans               │
                                  │   ↕ TOOL spans               │
                                  └──────────────────────────────┘
                                           │ OTel/OTLP
                                           ▼
                                  ┌──────────────────┐
                                  │ Phoenix (local)   │
                                  │ http://localhost:  │
                                  │ 6006               │
                                  └──────────────────┘
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

From the `examples/agent-trajectory-evals/` directory:

```bash
# Run all 10 selected tasks
python -m tau_bench_openai_agents.run

# Run specific tasks
python -m tau_bench_openai_agents.run --tasks 0 50

# Run without Phoenix (no trace export)
python -m tau_bench_openai_agents.run --no-phoenix

# Save results to JSON
python -m tau_bench_openai_agents.run --output results.json
```

By default (when `--output` is not provided), results are saved to:

`examples/agent-trajectory-evals/results/tau_bench_openai_agents_<timestamp>.json`

## Selected Tasks

| Task ID | Category | Summary | Expected Actions |
|---------|----------|---------|-----------------|
| 0 | Multi-step mutation | Exchange keyboard + thermostat | 5 (lookup + exchange) |
| 10 | Policy-sensitive | Modify non-pending order → escalate | 5 (escalation) |
| 16 | Cancel/return combo | Cancel pending + return items + total | 9 (cancel + return) |
| 23 | Complex multi-order | Exchange + modify across orders | 12 |
| 24 | Simple lookup | Cancel non-pending → explain policy | 0 actions, has output |
| 50 | Quick escalation | Speed up delivery → transfer | 1 (escalation) |
| 59 | Cancel + modify | Cancel one + modify another + savings | 6 |
| 65 | Ambiguous | Exchange non-delivered → refuse | 3 (readonly) |
| 67 | Edge case | Wrong name → find user + order info | 5 (readonly) |
| 69 | Intent mapping | "Return" pending order → cancel | 4 (cancel) |

## File Structure

- `agent.py` — Agent definition + multi-turn conversation loop
- `tools.py` — 16 retail tools as `@function_tool` functions
- `db.py` — In-memory database loader (reuses tau-bench data)
- `user_sim.py` — Simulated user wrapper
- `phoenix_setup.py` — OpenInference instrumentation + Phoenix connection
- `tasks.py` — Selected task definitions
- `run.py` — Entry point

## Key Design Decisions

1. **Tools are native `@function_tool` functions** — the framework executes them, producing both LLM and TOOL spans naturally.
2. **Simulated user is outside instrumentation** — in production, the user would be a real human. We don't trace them.
3. **DB state is not traced** — a production app wouldn't trace database mutations through OTel either.
4. **`parallel_tool_calls=False`** — matches tau-bench's single-tool-per-turn policy.
5. **Temperature 0** — for reproducibility, matching tau-bench's original evaluation setup.
