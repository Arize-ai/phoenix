---
name: phoenix-frontend
description: Frontend development guidelines for the Phoenix AI observability platform. Use when writing, reviewing, or modifying React components, TypeScript code, styles, or UI features in the app/ directory. Triggers on any frontend task — new components, UI changes, styling, accessibility fixes, form handling, or component refactoring. Also use when the user asks about frontend conventions or component patterns for this project. For design system rules (error display, layout, dialogs, tokens), use the phoenix-design skill.
metadata:
  internal: true
---

# Phoenix Frontend Development

Composable rules for building UI in the Phoenix app. Before starting work, explore `app/src/components/` and `app/package.json` to understand existing patterns, packages, and conventions — then follow these rules.

## Rule Files

Read the relevant file(s) based on the task:

| Rule file | When to read |
|-----------|-------------|
| `rules/components.md` | Creating, composing, or refactoring components |
| `rules/relay.md` | Using Relay |
| `rules/accessibility.md` | Any interactive element, form, overlay, or semantic markup |
| `rules/resize-svg-logo-assets.md` | Adding or updating provider/integration logo icons |

## Verification

After visual changes, use `agent-browser` to verify the UI looks correct. When modifying a shared component, check its usages across the app.
