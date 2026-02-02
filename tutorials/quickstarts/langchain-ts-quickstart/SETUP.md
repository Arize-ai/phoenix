# Quick Setup Guide

Follow these steps to get your LangChain TypeScript application running:

## 1. Navigate to the directory

```bash
cd quickstarts/langchain-ts-quickstart
```

## 2. Install dependencies

```bash
npm install
```

This installs:
- `langchain` - The main LangChain library
- `zod` - Schema validation (used by LangChain tools)
- `@arizeai/phoenix-otel` - Phoenix tracing integration
- `tsx` - TypeScript execution (dev dependency)

## 3. Set your API key

Choose one:

```bash
# For OpenAI (GPT models)
export OPENAI_API_KEY=your-key-here

# OR for Anthropic (Claude models)
export ANTHROPIC_API_KEY=your-key-here
```

## 4. Start Phoenix (if running locally)

In a separate terminal:

```bash
pip install arize-phoenix
phoenix serve
```

Phoenix will be available at `http://localhost:6006`

## 5. Run the application

```bash
npm start
```

You should see:
- Questions being processed
- Agent responses
- Instructions to view traces in Phoenix

## File Structure Explained

```
langchain-ts-quickstart/
│
├── src/
│   ├── instrumentation.ts    ← Phoenix setup (imported first!)
│   └── index.ts              ← Your main application code
│
├── package.json              ← Dependencies and scripts
├── tsconfig.json             ← TypeScript configuration
├── README.md                 ← Full documentation
└── SETUP.md                  ← This file
```

**Important:** The `instrumentation.ts` file must be imported at the very top of `index.ts` before any other imports. This ensures Phoenix tracing is set up correctly.

## What the code does

1. **instrumentation.ts** - Configures OpenTelemetry to send traces to Phoenix
2. **index.ts** - Creates a LangChain agent with a weather tool and runs it

The agent will:
- Receive user questions
- Decide when to use tools
- Call the weather tool when needed
- Generate responses
- Send all traces to Phoenix for visualization

## Next Steps

- Modify `src/index.ts` to add more tools
- Change the system prompt to customize agent behavior
- Add memory/checkpointing for conversation history
- See the [LangChain quickstart](https://docs.langchain.com/oss/javascript/langchain/quickstart) for more examples

