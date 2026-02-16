---
name: figma-usage
description: Implement UI from Figma designs using the Figma MCP server, Code Connect, and Phoenix's Emotion/token styling system. Use when a user provides a Figma URL, asks to implement a design, match a mockup, or connect Figma components to code.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  mcp-server: figma
---

# Figma Usage

Translate Figma designs into Phoenix UI code using the Figma MCP server and the project's Emotion CSS-in-JS styling system.

## Quick Reference

| Task                       | Resource                      |
| -------------------------- | ----------------------------- |
| Set up MCP, authenticate   | `README.md`                   |
| Implement a Figma design   | `rules/implement-design.md`   |
| Translate values to tokens | `rules/tokens-and-styling.md` |
| Connect Figma ↔ code      | `rules/code-connect.md`       |

## Key Principles

| Principle | Action |
| --------- | ------ |
| Semantic tokens first | Match by purpose (rounding, spacing, font), not raw value |
| Reuse over recreate | Check `app/src/components/` and Code Connect before creating new |
| `#000000` is an error | Pure black usually means a missing Figma token - flag it |
| Metadata before context | Call `get_metadata` to explore, `get_design_context` for specific nodes |
| Emotion, never Tailwind | Figma MCP outputs Tailwind - always translate to Emotion `css` |
| Cheapest tool first | Use `add_code_connect_map` directly; avoid `get_code_connect_suggestions` |

## Workflow

**Implement a design from a Figma URL:**
`implement-design.md` steps 1-8 (parse URL → metadata → Code Connect check → design context → translate → validate)

**Connect a component to Figma (Code Connect):**
`rules/code-connect.md` — use `add_code_connect_map` directly when both sides are known; avoid expensive discovery tools

## Design System References

- [Core Figma file](https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=66-233) - design system components
- `app/src/GlobalStyles.tsx` - token definitions
- `app/src/components/` - component library (92 components)
- `app/stories/` - Storybook stories
