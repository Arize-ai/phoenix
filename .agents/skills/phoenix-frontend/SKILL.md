---
name: phoenix-frontend
description: Frontend development guidelines for the Phoenix AI observability platform. Use when writing, reviewing, or modifying React components, TypeScript code, styles, or UI features in the app/ directory. Triggers on any frontend task — new components, UI changes, styling, accessibility fixes, form handling, error display, layout work, or component refactoring. Also use when the user asks about frontend conventions, component patterns, or design standards for this project.
internal: true
---

# Phoenix Frontend Development

Composable rules for building UI in the Phoenix app. Before starting work, explore `app/src/components/` and `app/package.json` to understand existing patterns, packages, and conventions — then follow these rules.

## Rule Files

Read the relevant file(s) based on the task:

| Rule file | When to read |
|-----------|-------------|
| `rules/components.md` | Creating, composing, or refactoring components |
| `rules/design.md` | Layout, visual polish, error handling, loading states |
| `rules/relay.md` | Using Relay |
| `rules/accessibility.md` | Any interactive element, form, overlay, or semantic markup |

## Verification

After visual changes, use `agent-browser` to verify the UI looks correct. When modifying a shared component, check its usages across the app.
