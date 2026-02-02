# LangChain TypeScript Quickstart

A simple LangChain TypeScript application with Phoenix tracing integration.

## Prerequisites

- **Node.js 18+** installed
- **Phoenix** running locally (`pip install arize-phoenix && phoenix serve`) or access to Phoenix Cloud
- **API key** for either:
  - OpenAI (`OPENAI_API_KEY`) - for GPT models
  - Anthropic (`ANTHROPIC_API_KEY`) - for Claude models

## Setup

1. **Install dependencies:**

```bash
cd langchain-ts-quickstart
npm install
```

2. **Set environment variables:**

```bash
# Choose one:
export OPENAI_API_KEY=your-openai-api-key
# OR
export ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional: Custom Phoenix project name
export PHOENIX_PROJECT_NAME=langchain-ts-quickstart
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
- Create a simple LangChain chain with a prompt template and LLM
- Process multiple questions through the chain
- Send all traces to Phoenix for visualization

## What to Look For in Phoenix

Open Phoenix at `http://localhost:6006` after running the application.

### Traces

Each chain invocation creates a trace that shows:
- **Prompt Template** - The formatted prompt sent to the LLM
- **LLM Call** - The actual API call to OpenAI
- **Output Parser** - The parsed response

You can see:
- Token usage (input/output tokens)
- Latency metrics
- The full prompt and response
- Model information

### Project Structure

```
langchain-ts-quickstart/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .gitignore                # Git ignore file
├── src/
│   ├── instrumentation.ts    # Phoenix/OpenTelemetry setup (import this first!)
│   └── index.ts              # Main application with LangChain agent
└── README.md                 # This file
```

**Key Files:**
- `src/instrumentation.ts` - Sets up Phoenix tracing (must be imported first)
- `src/index.ts` - Main application code with LangChain chain
- `package.json` - Dependencies: `langchain`, `@langchain/openai`, `@langchain/anthropic`, `@arizeai/phoenix-otel`

## Next Steps

- Add more complex chains with multiple steps
- Integrate tools and agents
- Add RAG (Retrieval Augmented Generation) capabilities
- Set up evaluations to measure response quality

## Troubleshooting

**Error: No API key found**
- Make sure you've exported either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Example: `export OPENAI_API_KEY=your-key`

**No traces appearing in Phoenix**
- Ensure Phoenix is running: `phoenix serve`
- Check that the Phoenix endpoint is accessible (default: http://localhost:6006)
- Verify the project name matches in Phoenix UI
- Make sure `instrumentation.ts` is imported at the very top of your main file

**TypeScript errors**
- Run `npm install` to ensure all dependencies are installed
- Check that you're using Node.js 18+
- Make sure you're using the correct import paths (ES modules)

**Module not found errors**
- Ensure you've run `npm install`
- Check that `langchain` and `zod` are in your `package.json` dependencies

