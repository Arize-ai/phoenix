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

When a vendor ships a Claude Code plugin, install it as a plugin in
[`.claude/settings.json`](../../.claude/settings.json) (`extraKnownMarketplaces` and
`enabledPlugins`) instead of copying the skill here. Claude Code installs the plugin for
anyone who trusts the repository, and the vendor keeps it current.

| Plugin | Marketplace | Replaces |
| ------ | ----------- | -------- |
| `daytona` | `daytona` (github.com/daytona/skills) | Daytona sandbox and SDK reference |
| `mintlify` | `claude-plugins-official` | The Mintlify docs skill |

Skills whose vendor does not ship a plugin are vendored here with
`npx skills add <source> --project --agent universal` and tracked in
[`skills-lock.json`](../../skills-lock.json). The daily skills update workflow refreshes
them and opens a pull request.

| Skill | Source | Why vendored |
| ----- | ------ | ------------ |
| [create-task](create-task/) | `harbor-framework/harbor` | Harbor has no plugin |
| [rewardkit](rewardkit/) | `harbor-framework/harbor` | Harbor has no plugin |
| [gh-stack](gh-stack/) | `github/gh-stack` | gh-stack has no plugin |
| [vercel-react-best-practices](vercel-react-best-practices/) | `vercel-labs/agent-skills` | The Vercel plugin bundles 37 skills, commands, agents, and an MCP server; only this skill is wanted |
