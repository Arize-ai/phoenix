---
name: phoenix-design
description: BEM CSS naming conventions for the Phoenix frontend. Use when naming new CSS classes or className assignments in app/src/.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  internal: true
---

# Phoenix Design System — BEM Naming

## Pattern

```
block             → disclosure, tabs, slider
block__element    → slider__label, dialog__title, search-field__icon
block--modifier   → theme--dark, dropdown--picker
```

## Rules

- **Block**: A standalone component — `disclosure`, `search-field`, `toggle-button`
- **Element**: A part that cannot exist independently — uses `__` separator — `slider__label`, `field__icon`
- **Modifier**: A variant or state — uses `--` separator — `theme--dark`, `dropdown--picker`
- Compound names within a segment use hyphens: `search-field`, `toggle-button`, `dialog__close-button`
- **No prefix** — never add any prefix to class names

## Examples

```tsx
className="search-field"
className="search-field__clear"
className="disclosure__panel"
className="theme--dark"
```
