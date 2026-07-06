# Design Token Naming Guide

## What are design tokens

Design tokens are design decisions translated into CSS custom properties. They provide a single source of truth for colors, sizing, typography, borders, and spacing.

- Defined in `app/src/GlobalStyles.tsx`
- Consumed via `var(--token-name)` in Emotion CSS-in-JS
- Theme-aware: light and dark themes override token values

## Token types

| Type | Prefix/Pattern | Example | Purpose |
|------|---------------|---------|---------|
| Dimension (scale) | `--global-dimension-size-{n}` | `--global-dimension-size-200` → 16px | Responsive sizing on 8px grid |
| Dimension (static) | `--global-dimension-static-size-{n}` | `--global-dimension-static-size-100` → 8px | Fixed pixel values |
| Font size (scale) | `--global-dimension-font-size-{n}` | `--global-dimension-font-size-100` → 14px | Numeric scale font sizes |
| Font size (named) | `--global-font-size-{t-shirt}` | `--global-font-size-s` → 14px | T-shirt sized fonts (xxs–xxl) |
| Line height | `--global-line-height-{t-shirt}` | `--global-line-height-s` → 20px | T-shirt sized line heights |
| Global color | `--global-color-{hue}-{intensity}` | `--global-color-blue-500` | Raw color palette (100–1400) |
| Semantic color | `--global-color-{intent}` | `--global-color-danger` | Purpose: danger, success, warning, severe, info |
| Primary color | `--global-color-primary-{opacity}` | `--global-color-primary-500` | Gray-900 at opacity levels |
| Text color | `--global-text-color-{opacity}` | `--global-text-color-700` | Text at 90%/70%/50%/30% opacity |
| Static color | `--global-static-color-{bw}-{opacity}` | `--global-static-color-white-900` | Theme-invariant white/black |
| Border | `--global-border-size-{name}` / `--global-border-color-{variant}` | `--global-border-size-thin` | Widths and semantic border colors |
| Rounding | `--global-rounding-{name}` | `--global-rounding-medium` | Border radius (xsmall–full) |
| Grid/Layout | `--global-grid-{property}-{size}` | `--global-grid-gutter-small` | Grid gutters, margins, baseline |
| Component-specific | `--global-{component}-{property}` | `--global-button-primary-background-color` | Per-component design decisions |
| Chart | `--chart-{element}-{property}` | `--chart-axis-stroke-color` | Chart visualization tokens |
| CodeMirror | `--code-mirror-{element}-{property}` | `--code-mirror-editor-background-color` | Editor tokens |

## Naming structure

3-part structure following the context → common unit → clarification pattern:

```
--{scope}-{category}-{subcategory}-{variant}-{state}
```

- **scope**: `global` for system tokens; component/domain name for scoped tokens (`chart`, `code-mirror`)
- **category**: The token family — `color`, `dimension`, `font-size`, `border`, `rounding`, `button`, `table`, etc.
- **subcategory**: The specific property — `background-color`, `border-color`, `foreground-color`, `size`, `height`
- **variant**: Scale value (100–1400), t-shirt size (s/m/l), semantic name (primary/danger/success)
- **state**: Interaction state when needed — `hover`, `active`, `pressed`, `disabled`

### Decomposed examples

- `--global-button-primary-background-color-hover` → global + button + primary + background-color + hover
- `--global-color-gray-500` → global + color + gray + 500
- `--global-rounding-medium` → global + rounding + medium
- `--global-table-row-border-color` → global + table + row + border-color
- `--chart-cartesian-grid-stroke-color` → chart + cartesian-grid + stroke-color

## Alias tokens

Tokens that reference other tokens rather than hard-coded values. This is how Phoenix connects raw values to semantic meaning:

```css
--global-color-primary:         var(--global-color-gray-900);
--global-border-color-default:  var(--global-color-gray-300);
--global-rounding-small:        var(--global-dimension-static-size-50);
--global-button-primary-bg:     var(--global-color-gray-900);
```

## RGB companion pattern

Global colors provide `-rgb` variants for alpha manipulation:

```css
--global-color-gray-500-rgb: 141, 141, 141;
--global-color-gray-500: rgb(var(--global-color-gray-500-rgb));

/* Usage with custom alpha: */
background: rgba(var(--global-color-gray-500-rgb), 0.3);
```

## Usage guidelines

1. **Prefer alias/semantic tokens over globals** — use `--global-color-danger` not `--global-color-red-700`
2. **Prefer named sizes over numeric** — use `--global-font-size-s` not `--global-dimension-font-size-100`
3. **Use component tokens for their component** — `--global-button-*` for buttons only
4. **Never hardcode values** that have token equivalents
5. **Use RGB variants** for alpha needs — `rgba(var(--global-color-gray-900-rgb), 0.5)`

## Adding new tokens

- **Global tokens** → add to the appropriate CSS block in `GlobalStyles.tsx` (`baseTokensCSS`, `borderAndGridCSS`, etc.)
- **Component tokens** → create a `{component}CSS(theme: Theme)` function, add to `derivedCSS()` composition
- **Theme-dependent tokens** → must be defined per theme or use existing theme-aware aliases
- Values should reference other tokens where possible (aliasing over hardcoding)
