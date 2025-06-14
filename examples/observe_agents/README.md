# ⌚️📬 Observe Agents – Personal Assistant Demo

This example demonstrates **cross-language agents** that collaborate using modern agent frameworks while being fully **observable with Phoenix**.

> Arrange a meeting with Bob next week → find a slot, draft invite, send email, book the calendar.

## 🏗  Repository layout

```
observe_agents/
├── calendar_agent/     # TypeScript Mastra agent – Google Calendar
├── mail_agent/         # Python OpenAI Agent – Gmail
├── coordinator/        # Python OpenAI Agent – Orchestration
├── utils/              # Shared parsing helpers
└── README.md           # You are here
```

### calendar_agent (TS)
* **Framework**: Mastra.ai
* **Tools**: `listAvailability`, `createEvent`, `updateEvent`, `deleteEvent`
* Talks to Google Calendar via the official REST API.
* Emits Phoenix spans around every Calendar API call.
* Uses Mastra's `createTool` for structured tool definitions.

### mail_agent (Py)
* **Framework**: OpenAI Agents
* **Tools**: `send_mail`, `fetch_unread`, `search_threads`, `reply_thread`
* Automatically handles Gmail authentication and API calls.
* Uses a tiny `email_extractor` helper to parse addresses/attachments.
* Integrated with Phoenix for observability.

### coordinator (Py)
* **Framework**: OpenAI Agents
* High-level workflow engine that orchestrates the other agents.
* Example flow:
  1. Receives natural-language intent from the user.
  2. Calls calendar agent to get free slots.
  3. Drafts and sends an invite via mail agent.
  4. Books the slot via calendar agent.

## 🏗 Architecture

The agents communicate through their respective frameworks:
- **Calendar Agent**: Runs as a Mastra agent with HTTP endpoints
- **Mail Agent**: OpenAI Agent with Gmail integration
- **Coordinator**: OpenAI Agent that orchestrates the workflow

All agents emit traces to Phoenix for full observability of the multi-agent workflow.

## 🔧  Quick start

### Prerequisites
- **Phoenix server** running at `localhost:4317` (already running per requirements)
- Python 3.8+ and Node.js 18+

1. **Install deps**
   ```bash
   # Calendar agent (Mastra + OpenTelemetry)
   cd calendar_agent && pnpm install && cd ..

   # Mail + Coordinator (OpenAI Agents + OpenInference)
   python -m venv .venv && source .venv/bin/activate
   pip install -r mail_agent/requirements.txt
   pip install -r coordinator/requirements.txt
   ```

2. **Set env vars**
   ```bash
   export GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/creds.json
   export GMAIL_TOKEN_JSON=/path/to/gmail_token.json
   export OPENAI_API_KEY=sk-...
   ```

3. **Run agents (each in its own terminal)**
   ```bash
   pnpm --filter calendar_agent dev          # Mastra calendar agent with OTEL tracing
   python mail_agent/mail_agent.py           # OpenAI mail agent with OpenInference tracing
   python coordinator/coordinator.py         # OpenAI orchestrator with OpenInference tracing
   ```

4. **Ask questions**
   Interact with the Coordinator over stdio:
   ```bash
   Arrange a meeting with Alice next Tuesday
   ```

5. **View traces in Phoenix**
   Open Phoenix at the configured endpoint to see cross-language agent traces from all three agents.

## 🧩 Work remaining

- [x] Convert calendar agent to use Mastra framework
- [x] Convert Python agents to use OpenAI Agents framework
- [x] Add Phoenix / OpenInference instrumentation hooks pointing to localhost:4317
  - [x] Python agents: `phoenix.otel.register(auto_instrument=True)` + `openinference-instrumentation-openai-agents` + `openinference-instrumentation-mcp`
  - [x] TypeScript agent: `@arizeai/openinference-mastra` with `OpenInferenceOTLPTraceExporter`
- [ ] Implement `email_extractor` & `calendar_parser`

## 📊 Observability

All agents now emit traces to Phoenix at `localhost:4317`:

- **Python Agents** (mail_agent, coordinator): Use `phoenix.otel.register(auto_instrument=True)` with `openinference-instrumentation-openai-agents` for detailed OpenAI Agents workflow tracing, plus `openinference-instrumentation-mcp` for MCP context propagation
- **TypeScript Agent** (calendar_agent): Uses `@arizeai/openinference-mastra` with `OpenInferenceOTLPTraceExporter` to capture MCP server operations and tool calls
- **Cross-Agent Correlation**: OpenInference MCP instrumentation enables unified traces across client-server boundaries