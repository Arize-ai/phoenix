# Arize Phoenix Plugin

The Arize Phoenix Plugin is available under `plugins/arize-phoenix`. It bundles
a configurable connection to the Phoenix MCP server.

## Install from the marketplace

Add the repository as a marketplace and install the plugin:

```shell
codex plugin marketplace add Arize-ai/phoenix
codex plugin add arize-phoenix@arize-phoenix
```

Start a new Codex task after installation so the MCP tools are loaded.

## Configure the Phoenix endpoint

The bundled MCP connection reads `PHOENIX_ENDPOINT` and defaults to
`http://localhost:6006`. Its launcher appends `/mcp` unless the configured URL
already ends with that path.

Set the endpoint before starting Codex to connect to another Phoenix deployment:

```shell
export PHOENIX_ENDPOINT=https://your-phoenix.example.com
```

HTTP MCP URL fields do not expand environment variables, so the plugin uses its
bundled launcher and `mcp-remote` to bridge the configurable endpoint to Codex.
The launcher requires Node.js and downloads `mcp-remote` through `npx` when it
is not already cached.

Alternatively, register a per-user endpoint directly with the Phoenix CLI:

```shell
px setup mcp --agent codex --endpoint https://your-phoenix.example.com
```

The CLI appends `/mcp` and registers the endpoint in the user's Codex
configuration.
