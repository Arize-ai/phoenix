---
description: Overview of TypeScript packages for the Arize Phoenix API.
---

# TypeScript SDK Overview

The Arize Phoenix TypeScript SDKs provide packages for interacting with Phoenix, running evaluations, and sending traces.

## Packages

### [@arizeai/phoenix-client](./arizeai-phoenix-client.md)

TypeScript client for the Phoenix REST API. Manage prompts, datasets, experiments, and access all Phoenix endpoints with TypeScript auto-completion.

### [@arizeai/phoenix-evals](./arizeai-phoenix-evals.md)

Evaluation library for LLM applications. Create custom evaluators or use pre-built ones for hallucination detection, relevance scoring, and other evaluation tasks.

### [@arizeai/phoenix-otel](./arizeai-phoenix-otel.md)

OpenTelemetry wrapper for sending traces to Phoenix. Simplifies setup with automatic configuration and support for instrumenting Node.js applications.

### [Phoenix MCP Server](./mcp-server.md)

Model Context Protocol (MCP) server for Phoenix. Provides access to prompts, datasets, and experiments through the MCP standard for integration with Claude Desktop, Cursor, and other MCP-compatible tools.
