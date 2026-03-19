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

### Pattern

```
block             → disclosure, tabs, slider
block__element    → slider__label, dialog__title, search-field__icon
block--modifier   → theme--dark, dropdown--picker
```

### Rules

- **Block**: A standalone component — `disclosure`, `search-field`, `toggle-button`
- **Element**: A part that cannot exist independently — uses `__` separator — `slider__label`, `field__icon`
- **Modifier**: A variant or state — uses `--` separator — `theme--dark`, `dropdown--picker`
- Compound names within a segment use hyphens: `search-field`, `toggle-button`, `dialog__close-button`
- **No prefix** — never add any prefix to class names

### Examples

```tsx
className="search-field"
className="search-field__clear"
className="disclosure__panel"
className="theme--dark"
```

## CSS Design Tokens

Design tokens are CSS custom properties that encode design decisions. They are the source of truth for colors, sizing, typography, borders, and spacing across the Phoenix UI.

See [rules/tokens.md](rules/tokens.md) for the full token naming guide, including:

- Token types and prefixes
- Naming structure (`--{scope}-{category}-{subcategory}-{variant}-{state}`)
- Alias tokens and RGB companion patterns
- Usage guidelines and how to add new tokens
