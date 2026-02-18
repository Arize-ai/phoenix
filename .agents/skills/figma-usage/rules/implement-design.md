# Implement Design

Workflow for translating a Figma design into Phoenix code.

## When to Use

- User provides a Figma URL and asks to implement or match it
- User references a design from the "Core" Figma file
- User asks to build a component, page, or layout from a mockup

## Workflow

### 1. Parse the Figma URL

Extract the file key and node ID from the URL.

- URL format: `https://www.figma.com/design/:fileKey/:fileName?node-id=X-Y`
- File key: segment after `/design/`
- Node ID: value of `node-id` param (convert `X-Y` to `X:Y` for MCP tool calls)

### 2. Get the node tree

```
Call the Figma MCP get_metadata tool with the file key and node ID.
```

This returns a lightweight XML node map. Use it to understand the component
structure before fetching full design context.

### 3. Check for existing component mappings

```
Call the Figma MCP get_code_connect_map tool with the file key and node ID.
```

If mappings exist, use the mapped components directly. Do not recreate them.

### 4. Find existing components for unmapped nodes

Before creating anything new, search `app/src/components/` for a component
that matches the design. Check:

- Component names matching or similar to the Figma layer name
- Props that correspond to Figma variants
- Stories in `app/stories/` that show existing usage

If a close match exists, extend it rather than creating a new component.

### 5. Fetch design context for specific nodes

```
Call the Figma MCP get_design_context tool with the file key and node ID.
```

Scope to specific nodes, not entire frames. A single component can exceed
13k tokens. For complex designs:

1. Use the node tree from step 2 to identify sections
2. Fetch each section individually
3. Implement incrementally

### 6. Capture visual reference

```
Call the Figma MCP get_screenshot tool with the file key and node ID.
```

Keep this screenshot accessible for validation in the final step.

### 7. Translate to Phoenix conventions

The Figma MCP returns React + Tailwind by default. Translate everything:

- **Tailwind classes** become Emotion `css` tagged templates
- **Raw values** become semantic tokens (see `tokens-and-styling.md`)
- **Colors** resolve to CSS custom properties, never hardcoded
- **`#000000`** is almost always a Figma authoring error - flag it
- **Spacing** snaps to nearest `--global-dimension-size-*` token
- **Border radius** uses `--global-rounding-*`, not dimension tokens
- **Font sizes** use `--global-font-size-*` named scale

When making a best-guess token substitution, add a code comment noting it.

### 8. Validate against the screenshot

Compare the implementation against the screenshot from step 6.

Check: layout, spacing, typography, colors, interactive states.
Exact pixel matching is not the goal - token-correct theming is.

## Do Not

- Fetch `get_design_context` on an entire page or complex frame - break it into nodes
- Create a new component if one exists in `app/src/components/` that can be extended
- Hardcode any colors, spacing, or font sizes - always resolve to tokens
- Import icon packages - use assets from the Figma MCP payload
- Treat Figma output as final code - it represents design intent, not implementation

## What to Surface to the Developer

- Components in the design with no Code Connect mapping and no obvious codebase match
- Token mismatches (Figma values with no exact semantic token)
- Likely Figma authoring errors (`#000000`, missing token assignments)
- Layout patterns that don't map to existing Phoenix layout primitives

## See Also

- `tokens-and-styling.md` - Token resolution rules and priority order
- [Core design system components](https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=66-233) - Figma source of truth
- `app/src/GlobalStyles.tsx` - Full token definitions
- `app/src/components/` - Existing component library
- `app/stories/` - Storybook stories for existing components
