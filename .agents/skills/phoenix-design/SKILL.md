---
name: phoenix-design
description: Design system conventions for the Phoenix frontend — BEM CSS class naming and CSS custom property (design token) naming in GlobalStyles. Use when naming CSS classes, creating new tokens, or consuming tokens in app/src/.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.1.0"
  internal: true
---

# Phoenix Design System

## BEM CSS Class Naming

CSS classes follow BEM (Block, Element, Modifier) conventions with no prefix.

See [rules/bem.md](rules/bem.md) for the full naming guide, including:

- Block, element, and modifier patterns
- Separator conventions (`__` for elements, `--` for modifiers)
- Compound naming rules and examples

## Layout & Interaction

Skeleton loaders for loading states, single scrollable regions, and one invocation method per action.

See [rules/layout.md](rules/layout.md) for layout stability, scroll behavior, and interaction pattern rules.

## Alert Dialogs

Alert dialogs are interruptive and should be used sparingly — only for destructive confirmations, critical errors, or important acknowledgments. Never nest them. Titles state the outcome (no questions), and button labels must be specific and actionable ("Delete", not "Yes").

See [rules/dialogs.md](rules/dialogs.md) for variants, content standards, and writing guidelines.

## Error Display

Never use toasts for errors — they are ephemeral and inaccessible. Use inline `<Alert variant="danger">` banners instead, with error state local to the component that owns the mutation. Errors must be scoped to the appropriate level (field error slots for elements, section-level alerts for groups). Input restrictions must be communicated via description slots before submission.

See [rules/error-display.md](rules/error-display.md) for the full pattern, including error scoping, dialog placement, state lifecycle, input validation, and when toasts ARE appropriate (success only).

## CSS Design Tokens

Design tokens are CSS custom properties that encode design decisions. They are the source of truth for colors, sizing, typography, borders, and spacing across the Phoenix UI.

See [rules/tokens.md](rules/tokens.md) for the full token naming guide, including:

- Token types and prefixes
- Naming structure (`--{scope}-{category}-{subcategory}-{variant}-{state}`)
- Alias tokens and RGB companion patterns
- Usage guidelines and how to add new tokens
