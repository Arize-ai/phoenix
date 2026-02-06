# Quick Setup Guide

Follow these steps to get the LangChain TypeScript travel planner agent running.

## 1. Navigate to the directory

```bash
cd quickstarts/langchain-ts-quickstart
```

## 2. Install dependencies

```bash
npm install
```

This installs (among others):

- `langchain` – LangChain and agent
- `@langchain/core` – Callbacks and tools
- `zod` – Schema validation for tools
- `@arizeai/phoenix-otel` – Phoenix tracing
- `@arizeai/openinference-instrumentation-langchain` – LangChain instrumentation
- `@arizeai/phoenix-client`, `@arizeai/phoenix-evals` – Fetching spans and running evals
- `@ai-sdk/openai` – OpenAI-compatible models (agent and evals)
- `dotenv` – Load `.env`
- `tsx` – TypeScript execution (dev)

## 3. Set environment variables

Create a `.env` from `.env.example` and set at least:

```bash
# Required for the agent
OPENAI_API_KEY=your-key-here
TAVILY_API_KEY=your-tavily-key-here

# Optional: Phoenix (defaults)
PHOENIX_ENDPOINT=http://localhost:6006
PHOENIX_PROJECT_NAME=langchain-travel-agent
```

For `npm run custom_evals` you also need:

```bash
FIREWORKS_API_KEY=your-fireworks-key-here
```

## 4. Start Phoenix (if running locally)

In a separate terminal:

```bash
pip install arize-phoenix
phoenix serve
```

Phoenix will be available at `http://localhost:6006`.

## 5. Run the application

```bash
npm start
```

You should see:

- Three trip-planning queries (Ireland, Japan, Portugal) with destination, duration, and interests
- Agent responses using the three tools (essential_info, budget_basics, local_flavor)
- Traces in Phoenix at `http://localhost:6006`

## 6. (Optional) Run evaluations

After the agent has run and sent traces:

```bash
# Pre-built correctness eval (OpenAI)
npm run pre_built_evals

# Custom correctness eval (travel rubric, Fireworks)
npm run custom_evals
```

## File structure

```
langchain-ts-quickstart/
├── src/
│   ├── index.ts              # Phoenix register + LangChain travel agent
│   ├── tools.ts              # essential_info, budget_basics, local_flavor (Tavily)
│   ├── pre_built_evals.ts    # Pre-built correctness eval → Phoenix annotations
│   ├── custom_evals.ts       # Custom correctness eval (travel rubric, Fireworks)
│   └── instrumentation.ts   # Optional standalone Phoenix setup (not used by index.ts)
├── package.json              # Scripts: start, pre_built_evals, custom_evals
├── .env.example              # OPENAI, TAVILY, PHOENIX, FIREWORKS
├── README.md                  # Full documentation
└── SETUP.md                  # This file
```

**Note:** `index.ts` sets up Phoenix and LangChain instrumentation at the top of the file (it does not import `instrumentation.ts`).

## What the code does

1. **index.ts** – Registers Phoenix, instruments LangChain, and runs a travel planner agent that must call three tools per request and respond with Essentials, Budget, and Local flavor.
2. **tools.ts** – Defines three Tavily-backed tools: **essential_info** (weather, best time, attractions, etiquette), **budget_basics** (cost breakdown for destination + duration), **local_flavor** (experiences for destination + interests).
3. **pre_built_evals.ts** – Loads LangGraph spans from Phoenix, runs the built-in correctness evaluator, and logs annotations to Phoenix.
4. **custom_evals.ts** – Same span loading, runs a custom correctness template for the travel agent using a Fireworks model, and logs annotations as `custom_correctness`.

## Next steps

- Change destinations/durations/interests in `src/index.ts`
- Add or change tools in `src/tools.ts`
- Adjust the system prompt in `src/index.ts`
- Tweak the custom eval template in `src/custom_evals.ts`
- See the [LangChain JS docs](https://js.langchain.com/) for more examples
