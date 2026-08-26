# Phoenix Coding Agent Skills

This directory contains [skills](https://docs.anthropic.com/en/docs/claude-code/skills) that teach coding agents how to work with Phoenix. They can be used with Claude Code, Cursor, and other compatible tools.

## Public Skills

| Skill | Description |
| ----- | ----------- |
| [phoenix-cli](phoenix-cli/) | Debug LLM applications using the Phoenix CLI. Fetch traces, annotate spans and traces, analyze errors, inspect datasets, and query the GraphQL API. |
| [phoenix-evals](phoenix-evals/) | Build and run evaluators for AI/LLM applications using Phoenix. Code first, LLM for nuance, validate against humans. |
| [phoenix-tracing](phoenix-tracing/) | OpenInference semantic conventions and instrumentation for tracing LLM applications with Phoenix. Covers setup, span types, and production deployment. |

## Internal Skills

Every other skill in this directory is for people working on Phoenix itself and is marked in its `SKILL.md` frontmatter with:

```yaml
metadata:
  internal: true
```

The [`skills` CLI](https://github.com/vercel-labs/skills) hides flagged skills from `npx skills add Arize-ai/phoenix`, so end users see only the public skills above. Set the flag on any new skill that is not meant for Phoenix users; keys like `hidden` or `user-invocable` only affect Claude Code locally and do not hide a skill from `skills add`. To install an internal skill anyway, run `skills add` with `INSTALL_INTERNAL_SKILLS=1`.
