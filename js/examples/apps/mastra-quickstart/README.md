# Mastra + Phoenix TypeScript Quickstart

A quickstart that combines [Mastra](https://mastra.ai) (multi-agent framework) with [Phoenix](https://docs.arize.com/phoenix/) for tracing, evals, and experiments on a financial analysis agent system.

## What's in this quickstart

- **Agents**: Financial orchestrator (coordinates research + report), financial researcher (search + summary), financial writer (report from research).
- **Tools**: `financialSearchTool` (financial data lookup), `financialAnalysisTool` (runs researcher → writer pipeline).
- **Tracing**: Mastra observability exports traces to Phoenix via Arize exporter.
- **Evals**: Span-level completeness eval on orchestrator outputs (from `evals/evals.ts`).
- **Experiments**: Run the orchestrator on a Phoenix dataset and evaluate with a completeness classifier.

## Prerequisites

- **Node.js** >= 22.13.0
- **pnpm** (or npm)
- **Phoenix** server (local or hosted) for traces and experiments
- **OpenAI API key** for agents and evals

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Environment variables**

   Create a `.env` in the project root with:
   - `OPENAI_API_KEY` – used by Mastra agents and phoenix-evals
   - `PHOENIX_ENDPOINT` – Phoenix server URL (e.g. `http://localhost:6006`)
   - `PHOENIX_API_KEY` – (optional) if your Phoenix instance requires it
   - `PHOENIX_PROJECT_NAME` – (optional) project name for traces; default is `mastra-tracing-quickstart`

## Scripts

| Script             | Description                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Start Mastra dev server (agents + tools). Default API: `http://localhost:4111`.                                                                   |
| `pnpm build`       | Build the Mastra app.                                                                                                                             |
| `pnpm start`       | Run the built Mastra server.                                                                                                                      |
| `pnpm add_traces`  | Call the orchestrator with sample questions and send traces to Phoenix. **Requires Mastra server running** (e.g. `pnpm dev` in another terminal). |
| `pnpm evals`       | Fetch orchestrator spans from Phoenix, run completeness eval, and log annotations back to Phoenix.                                                |
| `pnpm experiments` | Run a Phoenix experiment: load dataset, run the orchestrator task on each example, evaluate with the completeness evaluator.                      |

## Typical workflow

1. **Start Phoenix** (if local).
2. **Start Mastra**: `pnpm dev`.
3. **Generate traces**: in another terminal, `pnpm add_traces` (or call the Mastra API with your own inputs).
4. **Run evals**: `pnpm evals` to score orchestrator spans and attach completeness annotations in Phoenix.
5. **Run experiments**: ensure you have a dataset (e.g. `"ts quickstart fails"`) with examples whose `input` is a messages array; then `pnpm experiments`.

## Project structure

```
src/mastra/
├── index.ts              # Mastra instance + Phoenix observability (Arize exporter)
├── agents/
│   ├── financial-orchestrator-agent.ts
│   ├── financial-researcher-agent.ts
│   └── financial-writer-agent.ts
├── tools/
│   ├── financial-search-tool.ts
│   └── financial-analysis-tool.ts
├── evals/
│   ├── add_traces.ts     # Sample questions → orchestrator → traces to Phoenix
│   └── evals.ts          # Completeness eval on spans, log annotations to Phoenix
└── experiments/
    └── experiment.ts     # runExperiment with dataset, task, completeness evaluator
```

## Dataset for experiments

The experiments script expects a Phoenix dataset (e.g. name `"ts quickstart fails"`) whose examples have an `input` field that is either:

- A messages array: `[{ "role": "user", "content": "Research AAPL, MSFT with focus on valuation" }]`, or
- An object with an `input` key that holds that array.

The task passes that input to the financial orchestrator agent and uses the returned report for the completeness evaluator.
