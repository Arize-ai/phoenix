# Arize Phoenix plugin for Claude Code

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that connects Claude Code to your Phoenix instance. It registers the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/mcp#remote-mcp-server) and installs all five public Phoenix skills, so Claude Code can explore traces, run evals, and instrument apps. This is the recommended way to connect Claude Code to Phoenix. See [Connect Your Coding Agent](https://arize.com/docs/phoenix/integrations/developer-tools/coding-agents).

## What you get

| Component | What it is |
| --------- | ---------- |
| `phoenix` MCP server | Streamable HTTP to `<PHOENIX_ENDPOINT>/mcp`. Defaults to a local Phoenix at `http://localhost:6006`. Signs in with your Phoenix account in the browser on first use. |
| `phoenix-cli` skill | Fetch traces, inspect datasets and experiments, query GraphQL with the `px` CLI. Needs `px` installed. |
| `phoenix-error-analysis` skill | Read sampled traces and group failures into categories that pick eval targets. |
| `phoenix-evals` skill | Build and run evaluators. |
| `phoenix-harbor` skill | Configure and interpret Harbor agent evaluations in Phoenix. |
| `phoenix-tracing` skill | Instrument apps with OpenInference. |

The skills are symlinks to the public skills in [`skills/`](../../../skills/), written by `make skills`. Claude Code copies the resolved files when it installs the plugin, so nothing is duplicated in the repository.

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

The setting configures the MCP server only. The `px` CLI is optional, and the plugin doesn't install it. If you want the `phoenix-cli` skill, [install the CLI](https://arize.com/docs/phoenix/integrations/developer-tools/cli#install). It reads `PHOENIX_ENDPOINT` and, if your Phoenix has auth enabled, `PHOENIX_API_KEY` from your shell.

The MCP server signs in with OAuth in the browser. It has no slot for an API key. For headless use, register the server yourself with `claude mcp add --transport http phoenix <PHOENIX_ENDPOINT>/mcp --header 'Authorization: Bearer ${PHOENIX_API_KEY}'`. Keep the single quotes so Claude Code expands the variable at runtime.

Requires Phoenix 19.0.0 or later, which serves `/mcp`.

## Install

```bash
claude plugin marketplace add Arize-ai/phoenix
claude plugin install arize-phoenix@arize-phoenix
```

Run `/mcp` inside Claude Code to confirm the `phoenix` server is connected and complete the login.

For local development, add the marketplace from a checkout instead: `claude plugin marketplace add ./` from the repository root. The trailing slash matters — a bare `.` is rejected as an invalid source.

Check changes with `claude plugin validate plugins/claude/arize-phoenix`. It warns that the `skills/` entries are symlinks it did not follow; that warning is expected, since `validate` reads components without following symlinks while a session loading the plugin does follow them. `claude plugin details arize-phoenix@arize-phoenix` on an installed copy confirms the resolved inventory: every skill in `skills/` and one MCP server.

## Evals

Behavioral tests for the plugin live under `evals/` and run with `claude plugin eval .` from this directory. See [Test plugins with evals](https://code.claude.com/docs/en/plugin-evals) for the case format, graders, MCP mocks, and CI usage. Run output under `evals/results/` is gitignored.
