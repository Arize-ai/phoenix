# General skills

Each subdirectory here is a skill (`<name>/SKILL.md` plus an optional
`resources/` directory) served to every Phoenix MCP consumer: coding agents at
the `/mcp` mount and the in-process PXI agent alike. A skill belongs here only
if it assumes nothing beyond the MCP tool surface. Skills that depend on
PXI-only affordances live in `src/phoenix/server/agents/prompts/skills/`.
