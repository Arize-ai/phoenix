# Code Review Guidelines

Hold every change to `AGENTS.md` § Code Standards: its Always Check, Style, Patterns to Flag and Security rules, and the area skills it lists. The rules live there so the agents that write code load the same rules review applies. This file covers how to report what you find. The BCP 14 keywords (MUST, SHOULD, ...) are interpreted as `AGENTS.md` § Code Standards defines them.

## Reporting Findings

- Each finding MUST be verified against the code before it is reported: quote the line, and for a bug name the input or state that triggers it
- Only problems the change introduces SHOULD be reported — pre-existing issues and anything a linter, formatter or type checker catches MUST NOT be
- Each root cause MUST be reported once, listing every location; generated-file drift is reported at its source
- Each finding MUST carry a severity: **Blocking** (wrong behavior, security, data loss, or a broken MUST) or **Non-blocking** (a broken SHOULD). Nits and praise SHOULD NOT be posted
- A convention finding MUST cite the rule it breaks in `AGENTS.md` § Code Standards or in `.agents/skills/`
- A finding SHOULD fit in five lines: what is wrong, the evidence, and a concrete fix

## Skip

- Generated files under `__generated__` directories
- Files under `node_modules/`, `dist/`, or `build/`
