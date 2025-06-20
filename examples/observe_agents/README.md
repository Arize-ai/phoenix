# ⌚️📬 Observe Agents – Personal Assistant Demo

This example demonstrates **Python-based agents** that collaborate using the OpenAI Agents framework while being fully **observable with Phoenix**.

> Arrange a meeting with Bob next week → find a slot, draft invite, send email, book the calendar.

## 🏗  Repository layout

```
observe_agents/
├── calendar_agent.py   # Python OpenAI Agent – Google Calendar
├── mail_agent/         # Python OpenAI Agent – Gmail
├── coordinator/        # Python OpenAI Agent – Orchestration
└── README.md           # You are here
```

### calendar_agent.py
* **Framework**: OpenAI Agents
* **Tools**: `list_availability`, `create_event`, `update_event`, `delete_event`, `list_upcoming_events`, `find_free_time`
* Talks to Google Calendar via the official REST API.
* Emits Phoenix spans around every Calendar API call.
* Uses OpenAI Agents' `@function_tool` decorator for structured tool definitions.

### mail_agent/
* **Framework**: OpenAI Agents
* **Tools**: `send_mail`, `fetch_unread`, `search_threads`, `extract_event_info`, `fetch_unread_with_events`
* Automatically handles Gmail authentication and API calls.
* Can extract meeting information from emails using AI.
* Integrated with Phoenix for observability.

### coordinator/
* **Framework**: OpenAI Agents
* High-level workflow engine that orchestrates the other agents through handoffs.
* Example flow:
  1. Receives natural-language intent from the user.
  2. Hands off to Calendar Agent to get free slots.
  3. Hands off to Mail Agent to draft and send invites.
  4. Hands off to Calendar Agent to book the slot.

## 🏗 Architecture

The agents are all built using the OpenAI Agents framework and communicate through handoffs:
- **Calendar Agent**: OpenAI Agent with Google Calendar integration
- **Mail Agent**: OpenAI Agent with Gmail integration  
- **Coordinator**: OpenAI Agent that orchestrates the workflow using handoffs to specialized agents

All agents emit traces to Phoenix for full observability of the multi-agent workflow.

## 🔧  Quick start

### Prerequisites
- **Phoenix server** running at `localhost:4317` (already running per requirements)
- Python 3.8+

1. **Install deps**
   ```bash
   # Install all dependencies
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Set env vars**
   ```bash
   export GMAIL_CLIENT_SECRET_JSON=/path/to/client_secret.json
   export GMAIL_TOKEN_JSON=/path/to/gmail_token.json
   export OPENAI_API_KEY=sk-...
   ```

3. **Run agents individually or use the coordinator**
   ```bash
   # Run individual agents
   python calendar_agent.py                  # Calendar agent 
   python mail_agent/mail_agent.py           # Mail agent
   
   # Or run the coordinator (recommended)
   python coordinator/coordinator.py         # Coordinator that uses both agents
   ```

4. **Ask questions**
   Interact with the Coordinator over stdio:
   ```bash
   Arrange a meeting with Alice next Tuesday
   ```

5. **View traces in Phoenix**
   Open Phoenix at the configured endpoint to see cross-language agent traces from all three agents.

## 🧩 Work completed

- [x] Simplified architecture to use Python-only agents
- [x] Convert all agents to use OpenAI Agents framework
- [x] Add Phoenix / OpenInference instrumentation hooks pointing to localhost:4317
  - [x] All agents: `phoenix.otel.register(auto_instrument=True)` + `openinference-instrumentation-openai-agents`
- [x] Implement event extraction from emails using AI
- [x] Full Google Calendar and Gmail integration

## 📊 Observability

All agents emit traces to Phoenix at `localhost:4317`:

- **All Agents** (calendar_agent, mail_agent, coordinator): Use `phoenix.otel.register(auto_instrument=True)` with `openinference-instrumentation-openai-agents` for detailed OpenAI Agents workflow tracing
- **Agent Handoffs**: OpenInference captures the handoff flow between the coordinator and specialized agents
- **Tool Calls**: Every Google Calendar and Gmail API call is traced with full context and parameters