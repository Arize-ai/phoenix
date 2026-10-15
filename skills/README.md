# Phoenix skills

This folder holds every [skill](https://agentskills.io) Phoenix ships to users. Edit skills here, then run `make skills` to update the copies the plugins, the MCP server and PXI read. CI runs `make skills-check` and fails if a copy is out of date.

| Skill | Description |
| ----- | ----------- |
| [phoenix-cli](phoenix-cli/) | Debug LLM applications using the Phoenix CLI. Fetch traces, annotate spans and traces, analyze errors, inspect datasets, and query the GraphQL API. |
| [phoenix-error-analysis](phoenix-error-analysis/) | Read sampled traces, spans, or sessions, write free-form notes, then group them into narrow one-dimension annotations with counts that pick eval targets and fix priorities. |
| [phoenix-evals](phoenix-evals/) | Build, run, and validate evaluators for AI/LLM applications using Phoenix. Code first, LLM for nuance, validate against humans. |
| [phoenix-harbor](phoenix-harbor/) | Configure and interpret the Phoenix plugin for Harbor agent evaluations. |
| [phoenix-tracing](phoenix-tracing/) | OpenInference semantic conventions and instrumentation for tracing LLM applications with Phoenix. Covers setup, span types, and production deployment. |

## Where a skill goes

Each skill lists where it ships in its `SKILL.md` frontmatter, as a space-separated string:

```yaml
metadata:
  targets: "agents mcp"
```

| Target | Who gets the skill | How |
| ------ | ------------------ | --- |
| `agents` | `npx skills add`, `px setup`, and the Claude Code, Cursor and Codex plugins | Installed as files. The plugins link or list the folder. |
| `mcp` | Clients of the Phoenix MCP server | `make skills` copies it to `src/phoenix/server/mcp/skills/`. |
| `pxi` | PXI, on top of its own skills | `make skills` copies it to `src/phoenix/server/agents/prompts/public_skills/`. |

`npx skills add` offers every skill in this folder, whatever its targets. Skills that need a shell, such as `phoenix-cli`, leave out `mcp` and `pxi`.

Skills for people working on Phoenix itself live in [`.agents/skills/`](../.agents/skills/), and PXI-only skills live in [`src/phoenix/server/agents/prompts/skills/`](../src/phoenix/server/agents/prompts/skills/).
