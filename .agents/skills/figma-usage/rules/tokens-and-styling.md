# Tokens and Styling

How to translate Figma MCP output into Phoenix's styling system.

## Styling Approach

- Use Emotion CSS-in-JS (`css` tagged templates) for all styling
- Never use Tailwind classes, even though the Figma MCP outputs them
- Never use inline styles unless truly necessary for dynamic values
- Postfix style variables with `CSS` (e.g., `const buttonCSS = css`...``)
- Use data attributes for component variants
- Keep styles co-located with components

## Token Source

All tokens are CSS custom properties defined in `app/src/GlobalStyles.tsx`.
Read this file directly for the full reference. Do not hardcode values.

## Token Resolution

When translating Figma values to tokens, match by semantic purpose first, not raw value.

### Priority order

1. **Semantic / component tokens** - most specific to the usage context
   - `--global-background-color-*` (default, light, dark, danger)
   - `--global-border-color-*` (default, light, dark)
   - `--global-button-*-*` (primary, danger, success variants)
   - `--global-rounding-*` (xsmall, small, medium, large)
   - `--global-font-size-*` (xxs through xxl)
   - `--global-color-primary-*`, `--global-color-danger`, `--global-color-success`, etc.
2. **Base color scale** - when no semantic token fits
   - `--global-color-gray-*` (50-900)
   - `--global-color-red-*`, `--global-color-blue-*`, etc.
3. **Dimension scale** - for spacing, sizing, padding, gaps
   - `--global-dimension-size-*` (0 through 6000, values in px)

### Examples

| Figma value | Wrong | Right | Why |
|-------------|-------|-------|-----|
| `border-radius: 4px` | `--global-dimension-size-50` | `--global-rounding-small` | Rounding context |
| `border-radius: 8px` | `--global-dimension-size-100` | `--global-rounding-medium` | Rounding context |
| `gap: 8px` | `--global-rounding-medium` | `--global-dimension-size-100` | Spacing context |
| `font-size: 14px` | `--global-dimension-font-size-100` | `--global-font-size-s` | Use the named scale |
| `background: gray` | `--global-color-gray-200` | `--global-background-color-light` | Semantic background |

When multiple tokens resolve to the same value, pick the one matching the usage
context. If the best match is ambiguous, add a code comment noting the choice.

## Color Rules

- Never hardcode hex or rgb values
- Use semantic color tokens (`--global-color-primary`, `--global-color-danger`, etc.) over raw scale values (`--global-color-red-600`) when the usage is semantic
- Colors are theme-aware (dark/light) via CSS custom properties - hardcoding breaks theming

### #000000 is almost always an error

Pure black (`#000000`, `rgb(0,0,0)`) in Figma output usually means a color token
was never applied. Do not use it literally.

- For text: use `--global-color-gray-900` (the primary text color) or `--global-color-primary`
- For backgrounds/borders: find the appropriate semantic token
- Flag the discrepancy - the Figma file likely needs fixing too

## When to Correct vs Note vs Flag

- **Silently correct**: Small spacing snaps (1-2px to nearest `--global-dimension-size-*` token)
- **Note** (code comment): Best-guess token substitution where multiple tokens could match, or Figma value doesn't exactly match any token
- **Flag** (ask the developer): `#000000` or other likely authoring errors, colors with no plausible token match, layout patterns that suggest a missing token

## See Also

- `implement-design.md` - Full workflow for implementing Figma designs
- `app/src/GlobalStyles.tsx` - Token definitions (read directly for full reference)
- `app/.cursor/rules/styling/RULE.md` - Additional Emotion conventions
