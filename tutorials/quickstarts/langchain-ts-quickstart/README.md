# LangChain TypeScript Quickstart

A LangChain TypeScript travel planner agent with Phoenix tracing and optional evaluations.

## Prerequisites

- **Node.js 18+** installed
- **Phoenix** running locally (`pip install arize-phoenix && phoenix serve`) or access to Phoenix Cloud
- **OpenAI API key** (`OPENAI_API_KEY`) – for the agent LLM
- **Tavily API key** (`TAVILY_API_KEY`) – for tool search (essential_info, budget_basics, local_flavor)

## Setup

1. **Install dependencies:**

```bash
cd langchain-ts-quickstart
npm install
```

2. **Set environment variables:**

Copy `.env.example` to `.env` and fill in:

```bash
# Required for the agent
OPENAI_API_KEY=your-openai-api-key
TAVILY_API_KEY=your-tavily-api-key

# Optional: Phoenix (defaults shown)
PHOENIX_ENDPOINT=http://localhost:6006
PHOENIX_PROJECT_NAME=langchain-travel-agent

# Optional: for custom_evals (uses Fireworks model)
FIREWORKS_API_KEY=your-fireworks-api-key
```

3. **Start Phoenix** (if running locally):

```bash
pip install arize-phoenix
phoenix serve
```

## Running the Application

```bash
npm start
```

This will:

- Create a LangChain agent with three tools: **essential_info**, **budget_basics**, **local_flavor**
- Run three trip-planning queries (Ireland, Japan, Portugal) with destination, duration, and interests
- Send all traces to Phoenix for visualization

The agent is instructed to call all three tools per request and to structure replies as: (a) Essentials, (b) Budget, (c) Local flavor.

## Evaluations

After running the agent and sending traces to Phoenix, you can run evaluations against those traces.

**Pre-built correctness evaluator** (uses OpenAI by default):

```bash
npm run pre_built_evals
```

- Fetches LangGraph (agent) spans from Phoenix, runs a built-in correctness evaluator, and logs annotations back to Phoenix.
- Set `OPENAI_API_KEY` for the default evaluator model. Optional: use a custom LLM (e.g. Fireworks) by uncommenting and configuring the block in `src/pre_built_evals.ts`.

**Custom correctness evaluator** (travel-agent rubric, uses Fireworks):

```bash
npm run custom_evals
```

- Uses a custom classification evaluator with a travel-plan correctness template.
- Requires `PHOENIX_ENDPOINT` or `PHOENIX_HOST` and `FIREWORKS_API_KEY`.
- Evaluates the same LangGraph spans and logs annotations as `custom_correctness`.

## What to Look For in Phoenix

Open Phoenix at `http://localhost:6006` after running the application.

### Traces

Each agent invocation creates a trace that shows:

- **LangGraph** (agent) span with input messages and final output
- Tool calls: **essential_info**, **budget_basics**, **local_flavor** (Tavily-backed)
- Token usage, latency, prompts, and responses

After running evals, you’ll see span annotations (e.g. correctness / custom_correctness) on the LangGraph spans.

### Project Structure

```
langchain-ts-quickstart/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Example environment variables
├── src/
│   ├── index.ts              # Main app: Phoenix register + LangChain agent
│   ├── tools.ts              # Travel tools (essential_info, budget_basics, local_flavor)
│   ├── pre_built_evals.ts    # Pre-built correctness eval → Phoenix annotations
│   ├── custom_evals.ts       # Custom correctness eval (travel rubric, Fireworks)
│   └── instrumentation.ts   # Standalone Phoenix setup (optional; index.ts inlines its own)
├── README.md
└── SETUP.md
```

**Key files:**

- `src/index.ts` – Registers Phoenix (`@arizeai/phoenix-otel`), instruments LangChain, and runs the travel agent with `travelTools`.
- `src/tools.ts` – Defines the three Tavily-backed tools and their schemas (destination, duration, interests).
- `src/pre_built_evals.ts` – Fetches agent spans, runs Phoenix correctness evaluator, logs annotations.
- `src/custom_evals.ts` – Same span fetch, custom correctness template and Fireworks LLM, logs annotations.

**Dependencies (high level):** `langchain`, `@langchain/core`, `@arizeai/phoenix-otel`, `@arizeai/openinference-instrumentation-langchain`, `@arizeai/phoenix-client`, `@arizeai/phoenix-evals`, `@ai-sdk/openai`, `dotenv`, `zod`.

## Troubleshooting

**Error: OPENAI_API_KEY or TAVILY_API_KEY not set**

- Ensure both are set (e.g. in `.env` or `export OPENAI_API_KEY=...` and `export TAVILY_API_KEY=...`).

**No traces appearing in Phoenix**

- Ensure Phoenix is running: `phoenix serve`
- Check that the Phoenix endpoint is accessible (default: http://localhost:6006)
- Verify `PHOENIX_PROJECT_NAME` matches what you open in the UI (default: `langchain-travel-agent`)

**TypeScript / module errors**

- Run `npm install` and use Node.js 18+
- Confirm `"type": "module"` and import paths match your setup

**"Failed to log annotations to Phoenix: ... 404 Not Found"** (when running `npm run pre_built_evals` or `npm run custom_evals`)

- The Phoenix server may not expose the span annotations API. Upgrade and restart:
  ```bash
  pip install -U arize-phoenix
  phoenix serve
  ```
- Or run from the Phoenix repo root: `uv run phoenix serve`
- Evals still run and print results; only sending annotations to Phoenix fails until the server is upgraded.

**custom_evals: Set PHOENIX_ENDPOINT or PHOENIX_HOST**

- Set one of these in `.env` (e.g. `PHOENIX_ENDPOINT=http://localhost:6006`) and ensure `FIREWORKS_API_KEY` is set for the Fireworks evaluator model.
