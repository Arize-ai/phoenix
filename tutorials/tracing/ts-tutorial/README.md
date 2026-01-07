# Phoenix Tracing Tutorial (TypeScript)

Build a support agent and trace every LLM call, tool execution, and RAG retrieval with Phoenix. Evaluate response quality with annotations and LLM-as-Judge. Track multi-turn conversations as sessions.

This tutorial accompanies the Phoenix Tracing Tutorial documentation:
- [Chapter 1: Your First Traces](https://docs.arize.com/phoenix/tracing/tutorial/your-first-traces)
- [Chapter 2: Annotations and Evaluation](https://docs.arize.com/phoenix/tracing/tutorial/annotations-and-evaluation)
- [Chapter 3: Sessions](https://docs.arize.com/phoenix/tracing/tutorial/sessions)

## Prerequisites

- **Node.js 18+** installed
- **Phoenix** running locally (`pip install arize-phoenix && phoenix serve`) or access to Phoenix Cloud
- **OpenAI API key**

## Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Set environment variables:**

```bash
# OpenAI API key (required)
export OPENAI_API_KEY=your-openai-api-key

# Optional: Custom Phoenix endpoint (defaults to http://localhost:6006)
export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

3. **Start Phoenix** (if running locally):

```bash
pip install arize-phoenix
phoenix serve
```

## Chapter 1: Your First Traces

```bash
pnpm start
```

This runs the complete support agent that demonstrates:
- **Query Classification** - LLM decides if it's an order status or FAQ question
- **Tool Calls** - For order status, calls `lookupOrderStatus` tool and summarizes results
- **RAG Pipeline** - For FAQs, embeds the query, searches knowledge base, generates answer
- **Interactive Feedback** - After all responses, prompts you to rate each one (y/n/s)

## Chapter 2: Annotations and Evaluation

After running the agent, evaluate the responses:

```bash
pnpm evaluate
```

This runs LLM-as-Judge evaluations that:
- Fetch recent spans from Phoenix
- Run **tool_result** (success/error) checks on tool calls
- Run **retrieval_relevance** (LLM-as-Judge) on RAG queries
- Log evaluation results back to Phoenix as annotations
- Print a summary of pass/fail rates

## Chapter 3: Sessions

Run multi-turn conversation demos:

```bash
pnpm sessions
```

This runs three conversation scenarios:
- **Order Inquiry** - Customer asks about order, then follow-up questions
- **FAQ Conversation** - Multiple FAQ questions in one session
- **Mixed Conversation** - Switching between order and FAQ topics

Each conversation gets a unique session ID. View them in Phoenix's **Sessions** tab.

Then evaluate sessions:

```bash
pnpm evaluate:sessions
```

This runs session-level evaluations:
- **Conversation Coherence** - Did the agent maintain context?
- **Resolution Status** - Was the customer's issue resolved?

## What to Look For in Phoenix

Open Phoenix at `http://localhost:6006` after running the scripts.

### Traces (Chapter 1)

Each `support-agent` trace shows the complete request flow:

**Order Status Query:**
```
support-agent (AGENT)
├── ai.generateText (classification → "order_status")
├── ai.generateText (with tool call)
│   └── tool: lookupOrderStatus
└── ai.generateText (summarizes tool result)
```

**FAQ Query:**
```
support-agent (AGENT)
├── ai.generateText (classification → "faq")
├── ai.embed (query embedding)
└── ai.generateText (RAG generation)
```

### Annotations (Chapter 2)

Check the **Annotations** tab on each trace to see:
- **user_feedback** - Interactive thumbs up/down from users
- **tool_result** - Code-based: success/error
- **retrieval_relevance** - LLM evaluation: relevant/irrelevant

Filter traces by annotation values to find patterns in failures.

### Sessions (Chapter 3)

Click the **Sessions** tab in Phoenix to see:
- **Conversation threads** - All turns grouped by session ID
- **Chat view** - Click into a session to see the full back-and-forth
- **Session annotations** - Coherence and resolution status on the last turn

Filter sessions by `conversation_coherence` or `resolution_status` to find problematic conversations.

## Project Structure

```
ts-tutorial/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── instrumentation.ts    # Phoenix/OpenTelemetry setup
├── support-agent.ts      # Chapter 1 & 3: Support agent with sessions support
├── evaluate-traces.ts    # Chapter 2 & 3: LLM-as-Judge evaluation (spans + sessions)
└── README.md             # This file
```