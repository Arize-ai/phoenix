# Arize Phoenix plugin for Claude Code

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that connects Claude Code to your Phoenix instance. It registers the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/remote-mcp) and ships the public Phoenix skills, so Claude Code can explore traces, run evals, and instrument apps.

## What you get

| Component | What it is |
| --------- | ---------- |
| `phoenix` MCP server | Streamable HTTP to `<PHOENIX_ENDPOINT>/mcp`. Defaults to a local Phoenix at `http://localhost:6006`. Signs in with your Phoenix account in the browser on first use. |
| `phoenix-cli` skill | Fetch traces, inspect datasets and experiments, query GraphQL with the `px` CLI. |
| `phoenix-evals` skill | Build and run evaluators. |
| `phoenix-tracing` skill | Instrument apps with OpenInference. |

The skills are symlinks to the public skills in [`.agents/skills/`](../../../.agents/skills/). Claude Code copies the resolved files when it installs the plugin, so nothing is duplicated in the repository.

## Configure

The plugin has one setting, **Phoenix endpoint**, which Claude Code asks for when you enable the plugin. Set it to your Phoenix base URL with no trailing slash, for example `https://phoenix.example.com`. Leave the default for a local Phoenix at `http://localhost:6006`. The plugin appends `/mcp`.

To set it non-interactively, pass `--config endpoint=https://phoenix.example.com` to `claude plugin install`. To change it later, run `/plugin configure arize-phoenix@arize-phoenix` inside Claude Code, or edit `pluginConfigs` in your user settings (`~/.claude/settings.json`):

```json
{
  "pluginConfigs": {
    "arize-phoenix@arize-phoenix": {
      "options": { "endpoint": "https://phoenix.example.com" }
    }
  }
}
```

The setting configures the MCP server only. The `px` CLI used by the `phoenix-cli` skill reads `PHOENIX_ENDPOINT` and, if your Phoenix has auth enabled, `PHOENIX_API_KEY` from your shell, so export those too.

The MCP server signs in with OAuth in the browser. There is no slot for an API key; for headless use, register the server yourself with `px setup mcp --agent claude --header 'Authorization: Bearer ${PHOENIX_API_KEY}'`.

Requires Phoenix 19.0.0 or later, which serves `/mcp`.

## Install

```bash
claude plugin marketplace add Arize-ai/phoenix
claude plugin install arize-phoenix@arize-phoenix
```

Run `/mcp` inside Claude Code to confirm the `phoenix` server is connected and complete the login.

For local development, add the marketplace from a checkout instead: `claude plugin marketplace add .` from the repository root.
