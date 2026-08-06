# Mastra Agent with Arize Phoenix Tracing

A movie recommendation agent built with Mastra and traced with Arize Phoenix.

## Setup

### 1. Setup Phoenix

Get started with Phoenix here: https://arize.com/docs/phoenix/get-started

If running locally, Phoenix will be available at `http://localhost:6006`.

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:

- `@ai-sdk/openai` - OpenAI SDK for AI SDK
- `@mastra/core` - Mastra core framework
- `@mastra/arize` - Arize Phoenix Tracing integration
- `zod` - Schema validation
- `dotenv` - Environment variable management
- `@arizeai/phoenix-evals` - Arize Phoenix Evals TS Library
- `@arizeai/phoenix-client/spans` - Arize Phoenix Client library

### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key-here

# Phoenix Configuration — one variable per concern
PHOENIX_ENDPOINT=http://localhost:6006
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
PHOENIX_PROJECT_NAME=mastra-project
```

The eval script calls the Phoenix API on `PHOENIX_ENDPOINT`, the server's base URL.
`PHOENIX_COLLECTOR_ENDPOINT` is the exact URL traces are sent to — Mastra's
`ArizeExporter` POSTs to it verbatim, so it carries the OTLP `/v1/traces` path and
`src/mastra/index.ts` passes it straight through.

If you are using an instance with authentication enabled, also set
`PHOENIX_API_KEY=your-api-key` and point both variables at that instance:
`PHOENIX_ENDPOINT=https://phoenix.example.com` and
`PHOENIX_COLLECTOR_ENDPOINT=https://phoenix.example.com/v1/traces`.

## Running the Agent

Start the Mastra dev server:

```bash
npm run dev
```

Navigate to the Mastra Playground to interact with the movie recommendation agent.

## Viewing Traces

Once you've run the agent, open Phoenix. You'll see all agent runs, tool calls, and model interactions traced and visualized.

## Running Evals

Once you're ready to run Evals, run this from the example directory:

```bash
npm run eval
```

## Project Structure

```
src/
  mastra/
    agents/
      movie-agent.ts           # Movie recommendation agent
    tools/
      movie-selector-tool.ts   # Finds movies by genre
      reviewer-tool.ts         # Reviews and rates movies
      preview-summarizer-tool.ts # Summarizes movies
    index.ts                   # Mastra configuration with Arize Phoenix tracing
  eval/
    evals.ts                   # Tool Correctness & Goal Completion evals
```

## What's Included

- **Movie Recommendation Agent**: An agent that recommends movies using three tools:
  - MovieSelector: Finds movies by genre
  - Reviewer: Reviews and sorts movies by rating
  - PreviewSummarizer: Provides movie summaries
- **Arize Phoenix Tracing**: All agent interactions are automatically traced and sent to Phoenix
- **Arize Phoenix Evals**: Run Tool Correctness & Agent Goal Completion Evals using Phoenix Evals TS
