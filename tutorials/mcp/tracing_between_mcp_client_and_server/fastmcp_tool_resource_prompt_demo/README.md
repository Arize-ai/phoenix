# FastMCP Instrumentation Demo: Context Propagation Guide

## Motivation

Modern AI and agent systems demand robust observability—especially for distributed workflows involving LLMs and external tool chains. **Model Context Protocol (MCP)**, when instrumented with OpenTelemetry via OpenInference, enables full-stack, context-aware tracing across client/server and agent boundaries.

This guide provides a clear, minimal, and practical reference for **instrumenting MCP workflows** and **showcasing end-to-end context propagation**. It is designed for experienced engineers seeking to add or understand distributed tracing in real-world Python use cases like code review agents.

---

## What This Demo Shows

- **How to instrument both an MCP client and server** for complete traceability.
- **Context propagation**: Spans initiated on the client are visible and linked through the entire request flow (client ↔ server ↔ tools/resources).
- **Minimal, high-signal mocks**: The demo simulates a code review flow with relevant code files, review prompts, and agent-generated review comments.

---

## Prerequisites

- You should be familiar with Phoenix observability and have access to an [Phoenix project](https://docs.arize.com/phoenix/tracing/llm-traces-1/quickstart-tracing-python) with OpenTelemetry configuration.
- Python environment with `fastmcp`, `phoenix`, `openinference`, `openai`, `pydantic`, and `dotenv` installed.

---

## How to Reproduce This Demo

1. **Clone this directory and set up your environment:**
    ```sh
    pip install -r requirements.txt
    cp .example.env .env
    # Edit .env with your OpenAI and Arize credentials
    ```

2. **Ensure Phoenix/Arize is configured and running for your project.**  
   Reference [Arize LLM Quickstart](https://docs.arize.com/arize/observe/quickstart-llm) for help.

3. **Run the client (which starts up server) in a separate terminal:**
    ```sh
    python client.py
    ```

4. **Follow the client prompts to:**
    - Enter a PR ID.
    - Enter simple review instructions (e.g. "Check for security vulnerabilities" or "Assess performance issues").

5. **Observe traces in your Phoenix/Arize UI** for step-by-step feedback, and view full trace context and spans.

---

## What To Look For

- **End-to-end traces**: All operations, from client request to server response and tool/resource invocations, are linked in your tracing backend.
- **Span propagation**: Each span (client, agent, server, resource/tool) is clearly marked.
- **Minimal, realistic review artifacts**: The comments and checked checklists match only what was reviewed.

---

## Further Reference

- [Phoenix LLM Observability Quickstart](https://docs.arize.com/phoenix/tracing/llm-traces-1/quickstart-tracing-python)
- [OpenInference documentation](https://github.com/Arize-ai/openinference)
- [FastMCP project documentation](https://gofastmcp.com/getting-started/welcome)

