# Arize Phoenix for Cursor

This directory makes the Phoenix repository a [Cursor plugin](https://cursor.com/docs/plugins). Installing it gives Cursor the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/remote-mcp), the [docs MCP](https://arize.com/docs/phoenix/integrations/docs-mcp), and the three public coding-agent skills, so Cursor can debug traces, look up current docs, run evals, and instrument apps against your Phoenix instance.

## What you get

| Component | What it is |
| --------- | ---------- |
| `phoenix` MCP server | Streamable HTTP to `<PHOENIX_ENDPOINT>/mcp`. Defaults to a local Phoenix at `http://localhost:6006`. Authenticates with OAuth in the browser on first use. |
| `phoenix-docs` MCP server | Search over the Phoenix docs. No auth, no configuration. |
| `phoenix-cli` skill | Fetch traces, inspect datasets and experiments, query GraphQL with the `px` CLI. |
| `phoenix-evals` skill | Build and run evaluators. |
| `phoenix-tracing` skill | Instrument apps with OpenInference. |

The skills are the public skills in [`.agents/skills/`](../.agents/skills/), referenced directly from the manifest. Nothing is copied or symlinked.

## Requirements

- **Phoenix 19.0.0 or later.** Older servers do not serve `/mcp`; use the standalone [npm MCP server](https://arize.com/docs/phoenix/integrations/phoenix-mcp-server) instead.
- **Node.js** and the Phoenix CLI for the `phoenix-cli` skill: `npm install -g @arizeai/phoenix-cli`, or let the skill run it through `npx`.
- **Shell environment for the CLI.** The plugin variable below configures the MCP server only. The `px` CLI reads `PHOENIX_ENDPOINT` (and `PHOENIX_API_KEY` if your Phoenix has auth enabled) from your shell, so export those too. See [Coding Agents](https://arize.com/docs/phoenix/integrations/developer-tools/coding-agents#shared-environment-configuration).

## Configure

1. Install the plugin from **Customize → Plugins** (or locally, see below).
2. If your Phoenix is not at `http://localhost:6006`, set **Phoenix endpoint** to your base URL with no trailing slash, for example `https://phoenix.example.com`. Cursor exposes plugin variables under **Dashboard → Plugins → Configure**; on a team marketplace an admin sets the value once for everyone.
3. Use a Phoenix MCP tool once and complete the login in the browser.

If you cannot set plugin variables (for example, you are not on a team plan), skip the plugin's `phoenix` server and register it yourself instead. Either command writes the same `phoenix` entry to `~/.cursor/mcp.json`:

```bash
px setup mcp --agent cursor                       # OAuth, prompts for the endpoint
px setup mcp --agent cursor --header 'Authorization: Bearer ${PHOENIX_API_KEY}'   # API key, for headless use
```

The plugin has no slot for an API key; the `--header` form above is the supported path for headless or CI setups.

**Already added these servers by hand?** The plugin registers `phoenix` and `phoenix-docs` under the same names the docs and `px setup` use. Remove your manual entries from `~/.cursor/mcp.json` or `.cursor/mcp.json` to avoid two copies of each server.

## Local development

Cursor does not load symlinked local plugins ([cursor/plugins#35](https://github.com/cursor/plugins/issues/35)), so copy the plugin instead. From this repository:

```bash
dest=~/.cursor/plugins/local/arize-phoenix
rm -rf "$dest" && mkdir -p "$dest/.agents/skills"
cp -R .cursor-plugin "$dest/"
for s in phoenix-cli phoenix-evals phoenix-tracing; do cp -R ".agents/skills/$s" "$dest/.agents/skills/"; done
```

Then run **Developer: Reload Window** and confirm **Arize Phoenix** appears under Customize with both MCP servers and all three skills. Re-run the copy after editing the manifest or a skill.

## Publishing

The repository root is the plugin (single-plugin layout, no `marketplace.json`). Submit `Arize-ai/phoenix` at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). With the Cursor GitHub App installed and Auto Refresh on, pushes to `main` republish the plugin.

## Maintenance notes

- The docs MCP URL is also hardcoded in `js/packages/phoenix-cli/src/setup/agents/registry.ts`, `src/phoenix/server/agents/capabilities/docs_mcp.py`, and `docs/phoenix/integrations/docs-mcp.mdx`. Change them together.
- The `phoenix` and `phoenix-docs` server names mirror `PHOENIX_MCP_SERVER_NAME` and `DOCS_MCP_SERVER_NAME` in the CLI. Keep them in sync so a plugin install and a `px setup` install never diverge.
- Renaming or moving a skill under `.agents/skills/` must be mirrored in the `skills` array of `plugin.json`.
