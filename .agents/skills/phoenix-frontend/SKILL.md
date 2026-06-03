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
| `rules/test-ids.md` | Adding or changing `data-testid` attributes for E2E tests |
| `rules/resize-svg-logo-assets.md` | Adding or updating provider/integration logo icons |

## Verification

After visual changes, use `agent-browser` to verify the UI looks correct. When modifying a shared component, check its usages across the app.

## Route Metadata

When adding, removing, renaming, or materially changing what a page contains, update the route's `handle.agentRoute` metadata in `app/src/Routes.tsx` if an assistant agent should be able to link users to that destination. Keep metadata small and search-oriented:

- `label`: human page name.
- `description`: concise page purpose based on what the page now contains.
- `keywords`: user phrases PXI might hear when looking for that page.

If a content change makes an existing route easier or harder to find by natural language, adjust `description` or `keywords` in the same change.

## URL State

Significant view state must be recreatable from the URL. If a user can select a tab, sub-view, or detail state that should survive reloads, sharing, or adjacent-record pagination, encode it in route params or search params and preserve the relevant URL state during navigation.
