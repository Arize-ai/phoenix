# Arize Phoenix for Cursor

This directory makes the Phoenix repository a [Cursor plugin](https://cursor.com/docs/plugins). Installing it gives Cursor the Phoenix [remote MCP server](https://arize.com/docs/phoenix/integrations/mcp#remote-mcp-server), the [docs MCP](https://arize.com/docs/phoenix/integrations/mcp#phoenix-docs-mcp), and all five public Phoenix skills, so Cursor can debug traces, look up current docs, run evals, and instrument apps against your Phoenix instance.

## What you get

| Component | What it is |
| --------- | ---------- |
| `phoenix` MCP server | Streamable HTTP to `<PHOENIX_ENDPOINT>/mcp`. Defaults to a local Phoenix at `http://localhost:6006`. Authenticates with OAuth in the browser on first use. |
| `phoenix-docs` MCP server | Search over the Phoenix docs. No auth, no configuration. |
| `phoenix-cli` skill | Fetch traces, inspect datasets and experiments, query GraphQL with the `px` CLI. Needs `px` installed. |
| `phoenix-error-analysis` skill | Read sampled traces and group failures into categories that pick eval targets. |
| `phoenix-evals` skill | Build and run evaluators. |
| `phoenix-harbor` skill | Configure and interpret Harbor agent evaluations in Phoenix. |
| `phoenix-tracing` skill | Instrument apps with OpenInference. |

The skills are the public skills in [`skills/`](../skills/), referenced directly from the manifest. `make skills` writes the `skills` list in `plugin.json`; do not edit it by hand.

## Requirements

- **Phoenix 19.0.0 or later.** Older servers do not serve `/mcp`.
- **The Phoenix CLI, for the `phoenix-cli` skill only.** The plugin doesn't install `px`. To use that skill, [install the CLI](https://arize.com/docs/phoenix/integrations/developer-tools/cli#install), which needs Node.js, or let the skill run it through `npx`. The plugin variable below configures the MCP server only, so also export `PHOENIX_ENDPOINT` in your shell. If your Phoenix has auth enabled, export `PHOENIX_API_KEY` too. See [Find your Phoenix endpoint](https://arize.com/docs/phoenix/integrations/developer-tools/coding-agents#find-your-phoenix-endpoint).

## Configure

1. Install the plugin. It isn't in Cursor's public marketplace, so an admin adds it to a team marketplace by importing this repository under **Dashboard → Plugins & MCPs → Team Marketplaces**. Then install it from **Customize**. To install it locally, see below.
2. If your Phoenix is not at `http://localhost:6006`, set **Phoenix endpoint** to your base URL with no trailing slash, for example `https://phoenix.example.com`. Cursor exposes plugin variables under **Dashboard → Plugins → Configure**; on a team marketplace an admin sets the value once for everyone.
3. Use a Phoenix MCP tool once and complete the login in the browser.

If you can't set plugin variables, or you need an API key for headless or CI use, skip the plugin's `phoenix` server and add it to `~/.cursor/mcp.json` yourself. The plugin has no slot for an API key. Omit `headers` to sign in through the browser instead:

```json
{
  "mcpServers": {
    "phoenix": {
      "url": "https://phoenix.example.com/mcp",
      "headers": { "Authorization": "Bearer <your-api-key>" }
    }
  }
}
```

**Already added these servers by hand?** The plugin registers `phoenix` and `phoenix-docs` under the same names the docs and `px setup` use. Remove your manual entries from `~/.cursor/mcp.json` or `.cursor/mcp.json` to avoid two copies of each server.

## Local development

Cursor does not load symlinked local plugins ([cursor/plugins#35](https://github.com/cursor/plugins/issues/35)), so copy the plugin instead. From this repository:

```bash
dest=~/.cursor/plugins/local/arize-phoenix
rm -rf "$dest" && mkdir -p "$dest"
cp -R .cursor-plugin "$dest/"
cp -RL skills "$dest/"
```

Then run **Developer: Reload Window** and confirm **Arize Phoenix** appears under Customize with both MCP servers and every skill listed in `plugin.json`. Re-run the copy after editing the manifest or a skill.

## Publishing

The repository root is the plugin (single-plugin layout, no `marketplace.json`). Submit `Arize-ai/phoenix` at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). With the Cursor GitHub App installed and Auto Refresh on, pushes to `main` republish the plugin.

## Maintenance notes

- The docs MCP URL is also hardcoded in `js/packages/phoenix-cli/src/setup/agents/registry.ts`, `src/phoenix/server/agents/capabilities/docs_mcp.py`, and `docs/phoenix/integrations/mcp.mdx`. Change them together.
- The `phoenix` and `phoenix-docs` server names mirror `PHOENIX_MCP_SERVER_NAME` and `DOCS_MCP_SERVER_NAME` in the CLI. Keep them in sync so a plugin install and a `px setup` install never diverge.
- Run `make skills` after adding, renaming or retargeting a skill in `skills/`; it rewrites the `skills` array of `plugin.json`.
