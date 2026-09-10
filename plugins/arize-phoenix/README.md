# Arize Phoenix plugin

A [Codex plugin](https://developers.openai.com/codex/plugins) in the portable [Agent Plugins](https://agent-plugins.org) format. It registers the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/remote-mcp) so Codex can explore traces, sessions, datasets, experiments, and evaluations in your Phoenix instance.

## How it connects

Plugin MCP URLs cannot contain environment variables, so the plugin registers a small stdio launcher, `scripts/phoenix-mcp`, instead of a fixed URL. The launcher reads your environment and bridges to `<PHOENIX_ENDPOINT>/mcp` with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) via `npx`.

| Variable | Effect |
| -------- | ------ |
| `PHOENIX_ENDPOINT` | Base URL of your Phoenix instance, for example `https://phoenix.example.com`. Defaults to `http://localhost:6006`. |
| `PHOENIX_API_KEY` | Optional. When set, requests carry it as a bearer token and no browser login is needed. Otherwise Codex opens a browser window to sign in with your Phoenix account on first use. |

These are the same variables the `px` CLI reads. Export them in the shell you launch Codex from. Codex forwards only the variables the plugin declares, which is why both are listed in `mcp.json` and `.mcp.json`.

Requires Node.js, and Phoenix 19.0.0 or later, which serves `/mcp`.

## Files

| File | Purpose |
| ---- | ------- |
| `plugin.json`, `mcp.json` | Portable manifest and MCP server declaration. |
| `.codex-plugin/plugin.json`, `.mcp.json` | Codex overlay that turns the `${VAR}` entries in `mcp.json` into forwarded environment variables. Codex reads the portable files first; the overlay only adds `env_vars`. |
| `scripts/phoenix-mcp` | The stdio launcher. |

## Install locally

From the repository root:

```bash
codex plugin marketplace add .
codex plugin add arize-phoenix@arize-phoenix
```

Run `/mcp` inside Codex to confirm the `phoenix` server is connected.
