# ⌚️📬 Observe Agents – Personal Assistant Demo

This example demonstrates **Python-based agents** that collaborate using the OpenAI Agents framework while being fully **observable with Phoenix**.

> Arrange a meeting with Bob next week → find a slot, draft invite, send email, book the calendar.

## 🔧  Running the Project

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
   export OPENAI_API_KEY=sk-...
   ```
   See `.env.example`

3. **Generate Gmail Token File**
   ```bash
   python utils/generate_google_token.py
   ```
   Add resulting file path to your env file

4. **Setup Phoenix prompts**
   ```bash
   python utils/setup_prompts.py
   ```
   This creates the prompts for all three agents and tags them with "production". The agents will automatically load these prompts from Phoenix.

   *This script only needs to be run once on first setup*

5. **Run the Streamlit frontend**
   ```bash
   streamlit run front_end.py
   ```

   *Each agent can also be run directly instead of using the frontend*

6. **Ask questions**
   Interact with the Coordinator over stdio:
   ```bash
   Arrange a meeting with Alice next Tuesday
   ```

7. **View traces in Phoenix**
   Open Phoenix at the configured endpoint to see agent traces from all three agents.

## 🏗  Repository layout

```
observe_agents/
├── calendar_agent.py   # Python OpenAI Agent – Google Calendar
├── mail_agent.py       # Python OpenAI Agent – Gmail
├── coordinator.py      # Python OpenAI Agent – Orchestration
├── utils/
│   ├── setup_prompts.py        # Setup prompts in Phoenix
│   └── generate_google_token.py # Generate OAuth token for Gmail/Calendar
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

## 🎯 Prompt Management

The agents use **Phoenix for prompt management**, allowing you to:
- **Version control prompts**: Track changes to agent instructions over time
- **Tag prompts**: Use "production" tags to manage different versions
- **Dynamic loading**: Agents load prompts at runtime from Phoenix
- **Fallback handling**: If Phoenix is unavailable, agents use hardcoded fallbacks

**Key prompts:**
- `mail-agent-prompt`: Instructions for the Gmail agent
- `calendar-agent-prompt`: Instructions for the Google Calendar agent  
- `coordinator-agent-prompt`: Instructions for the orchestration agent
- `email-event-extraction-prompt`: AI prompt for extracting meeting/event information from emails

## 📊 Observability

All agents emit traces to Phoenix at `localhost:4317`:

- **All Agents** (calendar_agent, mail_agent, coordinator): Use `phoenix.otel.register(auto_instrument=True)` with `openinference-instrumentation-openai-agents` for detailed OpenAI Agents workflow tracing
- **Agent Handoffs**: OpenInference captures the handoff flow between the coordinator and specialized agents
- **Tool Calls**: Every Google Calendar and Gmail API call is traced with full context and parameters