# Phoenix MCP Server

A MCP server for Arize Phoenix.

## Installation

This package is installed using PNPM:

```bash
pnpm install @arize/phoenix-mcp-server
```

## Development

### Building

To build the project:

```bash
pnpm build
```

### Development Mode

To run in development mode:

```bash
pnpm dev
```

### Debugging

To run the debugger:

```bash
npx @modelcontextprotocol/inspector node ./build/index.js
```

## Environment Variables

The server requires the following environment variables:

- `PHOENIX_API_KEY`: Your Phoenix API key
- `PHOENIX_BASE_URL`: The base URL for Phoenix

## License

This project is licensed under the Elv2 license.
