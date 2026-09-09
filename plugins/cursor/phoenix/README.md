# Arize Phoenix for Cursor

Installs the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/remote-mcp) and the three public coding-agent skills so Cursor can debug traces, run evals, and instrument apps against your Phoenix instance.

## What you get

- **MCP** — streamable HTTP to `<phoenix>/mcp`. Defaults to local Phoenix at `http://localhost:6006/mcp`. Auth is OAuth (browser login on first use).
- **Skills** (symlinked from [`.agents/skills/`](../../../.agents/skills/)):
  - `phoenix-cli` — fetch traces, inspect datasets and experiments, query GraphQL
  - `phoenix-evals` — build and run evaluators
  - `phoenix-tracing` — OpenInference instrumentation

Requires Phoenix **19.0.0** or later (the `/mcp` endpoint).

## Configure

1. Install the plugin (Customize → Plugins, or a local symlink — see below).
2. If your Phoenix is not on localhost, open **Plugins → Configure** and set **Phoenix MCP URL** to `https://your-phoenix.example.com/mcp`.
3. Use an MCP tool once and complete the Phoenix login in the browser.

No API key is required. For headless or API-key setups, use `px setup mcp --agent cursor` instead of this plugin.

## Local development

From this repository:

```bash
ln -sfn "$(pwd)/plugins/cursor/phoenix" ~/.cursor/plugins/local/arize-phoenix
```

Then **Developer: Reload Window** and confirm the plugin under Customize. The skill symlinks resolve against this checkout; a marketplace install that copies only the plugin subdirectory will not.

## Marketplace

This plugin is listed from the repo-root [`.cursor-plugin/marketplace.json`](../../../.cursor-plugin/marketplace.json). Submit the `Arize-ai/phoenix` repository at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
