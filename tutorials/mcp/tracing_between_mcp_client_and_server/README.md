# MCP Client-Server Tracing Example

This example demonstrates how OpenTelemetry (OTEL) context can be propagated from an MCP client to an MCP server. This end-to-end tracing capability is made possible by the `openinference-instrumentation-mcp` package, which provides the necessary instrumentation for both client and server components.

## Overview

When properly instrumented, trace context is automatically propagated across the MCP client-server boundary, allowing you to:

- Track requests from client to server in a single trace
- Observe latency at different stages of the request lifecycle
- Debug issues that span across service boundaries

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Setup

1. Navigate to this directory:
   ```bash
   cd tutorials/mcp/tracing_between_mcp_client_and_server
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Example

1. Run Phoenix locally, or connect to an [instance online](https://app.phoenix.arize.com)

2. Update your .env file with OPENAI_API_KEY, and your PHOENIX_COLLECTOR_ENDPOINT. If you're using an online Phoenix instance or have auth enable, also set your PHOENIX_API_KEY.

3. Run the MCP client. The client code will spin up the server at run time in a separate process.
   ```bash
   python client.py
   ```

4. Ask questions of the agent.

5. View the traces in Phoenix:
![mcp-traces](https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-instrumentation.png)

## How It Works

The `openinference-instrumentation-mcp` package automatically:

1. Creates spans for MCP client operations
2. Injects trace context into MCP requests
3. Extracts and continues the trace context on the server side
4. Associates the context with any OTEL spans created on the server side

This allows you to see the complete request flow as a single trace, even though it crosses service boundaries.
