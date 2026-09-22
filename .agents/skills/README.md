# Phoenix Coding Agent Skills

This directory contains [skills](https://docs.anthropic.com/en/docs/claude-code/skills) that teach coding agents how to work with Phoenix. They can be used with Claude Code, Cursor, and other compatible tools.

## Public Skills

| Skill | Description |
| ----- | ----------- |
| [phoenix-cli](phoenix-cli/) | Debug LLM applications using the Phoenix CLI. Fetch traces, annotate spans and traces, analyze errors, inspect datasets, and query the GraphQL API. |
| [phoenix-error-analysis](phoenix-error-analysis/) | Read sampled traces, spans, or sessions, write free-form notes, then group them into narrow one-dimension annotations with counts that pick eval targets and fix priorities. |
| [phoenix-evals](phoenix-evals/) | Build and run evaluators for AI/LLM applications using Phoenix. Code first, LLM for nuance, validate against humans. |
| [phoenix-tracing](phoenix-tracing/) | OpenInference semantic conventions and instrumentation for tracing LLM applications with Phoenix. Covers setup, span types, and production deployment. |

The [Cursor plugin](../../.cursor-plugin/README.md) ships these three skills by listing their paths in `.cursor-plugin/plugin.json`. If you rename or move one, update that list.

## Third-Party Skills

When a vendor ships a Claude Code plugin, install it as a plugin instead of copying the
skill here. Codex and Cursor read the same plugin format, so one plugin serves three
tools; the vendor keeps it current.

| Plugin | Marketplace | Replaces |
| ------ | ----------- | -------- |
| `daytona` | github.com/daytona/skills | Daytona sandbox and SDK reference |
| `mintlify` | github.com/mintlify/mintlify-claude-plugin (also in `claude-plugins-official`) | The Mintlify docs skill |

How each tool picks them up:

- **Claude Code** enables them for anyone who trusts the repository through
  `extraKnownMarketplaces` and `enabledPlugins` in
  [`.claude/settings.json`](../../.claude/settings.json).
- **Codex** lists them in the repository marketplace
  [`.agents/plugins/marketplace.json`](../plugins/marketplace.json). Register it once with
  `codex plugin marketplace add Arize-ai/phoenix`, then
  `codex plugin add daytona@arize-phoenix` and `codex plugin add mintlify@arize-phoenix`.
- **Cursor** has no project-scoped plugins. Install Mintlify from the public marketplace,
  and load Daytona with `agent --plugin-dir <clone of daytona/skills>` or by importing
  github.com/daytona/skills as a team marketplace.
- **OpenCode** has no plugin support; it only reads skill directories. Install the skills
  for your user with `npx skills add daytona/skills -g` and `npx skills add mintlify.com -g`.

Skills whose vendor does not ship a plugin are vendored here with
`npx skills add <source> --project --agent universal` and tracked in
[`skills-lock.json`](../../skills-lock.json). The daily skills update workflow refreshes
them and opens a pull request.
