# Code Connect

How to link Figma components to code components bidirectionally.

## When to Use

- User asks to connect/link a Figma component to a code component
- User asks to map a Storybook story to a Figma design
- User wants bidirectional linking between Figma and code

## Bidirectional Linking

Full bidirectional linking has two sides, each using a different mechanism:

### Figma → Code (Figma Dev Mode shows code)

Use the MCP `add_code_connect_map` tool. This pushes the mapping directly
to Figma via the API — no publish step needed.

```
Call add_code_connect_map with:
  - fileKey and nodeId from the Figma URL
  - source: path to the component file
  - componentName: the component name
  - label: "React" (or "Storybook" for story links)
```

You can call it twice with different labels to show both the React source
and the Storybook story in Figma Dev Mode.

### Code → Figma (Storybook shows Figma design)

Add `parameters.design` to the story's metadata. This embeds the Figma
frame in Storybook's Design tab via `@storybook/addon-designs`.

```tsx
export default {
  title: "ComponentName",
  component: ComponentName,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/:fileKey/:fileName?node-id=X-Y",
    },
  },
};
```

See `README.md` Steps 3-4 for per-story overrides and details.

### Both sides are needed for full bidirectional linking.

## Tool Selection

### When the user specifies both the Figma node and code component

Go directly to `add_code_connect_map`. Do not call discovery tools first.

### User provides only a Figma URL, no code component specified → search the codebase first

1. Parse the Figma URL for fileKey and nodeId
2. Call `get_metadata` (cheap) to understand the component name and structure
3. Search `app/src/components/` and `app/stories/` for matching components
4. If a match is found, use `add_code_connect_map` directly
5. If no match is found, ask the user which component to map

### Only use `get_code_connect_suggestions` as a last resort

`get_code_connect_suggestions` is **expensive** — it fetches screenshots of
every variant in a component set and returns a large payload. Only use it when:

- You cannot identify any matching component after searching the codebase
- The Figma component name doesn't correspond to anything in the codebase
- The user explicitly asks you to find/suggest matches

Never call it when the user has already told you what to connect.

## Do Not

- Call `get_code_connect_suggestions` when both the Figma node and code component are known
- Call `get_design_context` or `get_screenshot` just to create a mapping — these are for implementation, not linking
- Guess component paths — verify they exist in the codebase first
- Use `add_code_connect_map` without also adding `parameters.design` to the story — both are needed for bidirectional linking

## See Also

- `README.md` - Steps 3-5 for Storybook design parameters and optional CLI publish
- `implement-design.md` - Full workflow for implementing designs (where discovery tools are appropriate)
- `app/src/components/` - Component library to search for matches
- `app/stories/` - Storybook stories
