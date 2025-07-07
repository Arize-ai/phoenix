# How to Implement End-to-End Tracing for MCP Client-Server Applications

This tutorial shows you how to propagate OpenTelemetry (OTEL) context between an MCP client and server for complete observability. The `openinference-instrumentation-mcp` package makes this possible by providing instrumentation for both client and server components.

## What is MCP and Why Do You Need Distributed Tracing?

One of the main benefits of Anthropic's Model Context Protocol (MCP) architecture is connecting AI models with information across different services, machines, and programming languages. This distributed approach delivers several advantages:

1. **Expanded AI Capabilities**: Connect models to specialized knowledge and data sources beyond their training data
2. **Plug-and-Play Components**: Add new context providers without retraining your models
3. **Multi-Language Support**: Implement context providers in any programming language while maintaining compatibility

The challenge? When requests flow through multiple services, debugging becomes difficult. How do you track a request's complete journey to identify where problems occur?

### How to Use OpenTelemetry for MCP Tracing

OpenTelemetry solves cross-service tracing challenges by:

- **Preserving Context Across Services**: Maintaining trace IDs and relationships between different components
- **Working Across Network Boundaries**: Automatically handling context in network requests
- **Supporting Multiple Languages**: Using standardized formats compatible with any programming language

When your client calls the server with proper instrumentation:
1. The client creates a span to track the operation
2. OTEL context automatically travels with the MCP request
3. The server continues the same trace without interruption
4. All context providers inherit this trace context
5. You see the complete interaction as one connected trace in Phoenix

This visibility is essential for troubleshooting complex AI systems, optimizing performance bottlenecks, and understanding how different components affect your application's behavior.


## Setup

When properly instrumented, trace context is automatically propagated across the MCP client-server boundary, allowing you to:

- Track requests from client to server in a single trace
- Observe latency at different stages of the request lifecycle
- Debug issues that span across service boundaries

### Env Setup

1. Open this directory independent of the rest of the Phoenix repo. This is critical to avoid shadowing the `agents` package name used by OpenAI.

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Example

1. Run Phoenix locally, or connect to an [instance online](https://app.phoenix.arize.com)

2. Update your .env file with `OPENAI_API_KEY`, and your `PHOENIX_COLLECTOR_ENDPOINT`. If you're using an online Phoenix instance or have auth enabled, also set your `PHOENIX_API_KEY`.

3. Run the MCP client. The client code will spin up the server at run time in a separate process.
   ```bash
   python client.py
   ```

4. Ask questions of the agent.

5. View the traces in Phoenix:
![mcp-traces](https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-instrumentation.png)

### How It Works

The `openinference-instrumentation-mcp` package automatically:

1. Creates spans for MCP client operations
2. Injects trace context into MCP requests
3. Extracts and continues the trace context on the server side
4. Associates the context with any OTEL spans created on the server side

This allows you to see the complete request flow as a single trace, even though it crosses service boundaries.
