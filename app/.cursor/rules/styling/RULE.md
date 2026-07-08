# Styling

## Code Style

- Use Emotion CSS-in-JS for all styling
- Use design tokens and CSS variables from `src/GlobalStyles.tsx`
- Use data attributes for component variants
- Use locally scoped CSS variables for readability
- Always postfix style variables with `CSS`

## Canonical Example

See `src/GlobalStyles.tsx` for design tokens and patterns.

## Workflow

1. Import emotion's `css` function
2. Use design tokens from GlobalStyles
3. Apply data attributes for variants
4. Keep styles co-located with components
