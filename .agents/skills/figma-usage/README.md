# Figma Usage

Connect Figma designs to the Phoenix codebase using the Figma MCP server and Code Connect.

## Prerequisites

- A Figma account with access to the Phoenix design files
- The Phoenix "Core" Figma file contains the design system components
- Code Connect mappings require an Organization or Enterprise Figma plan (we have this)

## Step 1: Connect the MCP Server

The repo includes `.mcp.json` with the remote Figma MCP server pre-configured.

**Claude Code:**

```bash
# The MCP server is auto-detected from .mcp.json on session start.
# Within claude code (interactive, recommended)
# Arrow down and launch in-browser auth
/mcp
# Alternatively, get status from outside claude code
claude mcp list
```

**Cursor:**

The `.mcp.json` is read automatically. If the Figma server doesn't appear, add it manually via Settings > MCP > Add new global MCP server with URL `https://mcp.figma.com/mcp`.

**Other MCP clients:**

Point your client at the remote server URL: `https://mcp.figma.com/mcp`

## Step 2: Verify the Connection

Ask your agent to fetch the node tree for a known component. A correct response will
describe the variants and props of the Figma component.

```
Call the Figma MCP get_metadata tool for the Button component:
https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2047
```

## Step 3: Link Figma Components to Stories

Adding a `parameters.design` block to a Storybook story serves two purposes:

1. **Storybook embed**: The `@storybook/addon-designs` addon displays the Figma
   frame in Storybook's Design tab, giving developers a visual reference.
2. **Code Connect mapping**: The `@figma/code-connect` package uses this link to
   publish mappings to Figma, so Dev Mode shows your actual component code.

Both packages are already installed as dev dependencies in `app/`.

### Minimum support: attach the entire figma component to every story variant

1. Get the component URL from the "Core" Figma file (right-click frame > Copy link)
2. Strip tracking parameters (keep only `node-id`, drop `t=...` etc.)
3. Add the `design` parameter to the story's default export / metadata:

```tsx
// app/stories/Button.stories.tsx
export default {
  title: "Button",
  component: Button,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2047",
    },
  },
};
```

### Improved support: per-story design configuration

The `parameters.design` in the default export applies to all stories. To show different
Figma frames for specific stories (e.g., variants or states), override at the story level
with links to the frame of a specific variant.

```tsx
export const Primary: Story = {
  args: { variant: "primary" },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2048",
    },
  },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2049",
    },
  },
};
```

## Step 4: View in Storybook

Navigate to a component and view the `Design` tab in the bottom panel

Example URL (button):
http://localhost:6007/?path=/story/button--default

## Step 5 (optional): Publish Code Connect Mappings

The Storybook embed works without publishing — only the Figma Dev Mode
integration requires publishing. To publish, you need a Figma access token:

1. Go to https://www.figma.com/settings → **Personal access tokens**
2. Click **Generate new token**, give it a name, and copy the token
3. Add the token to your shell config (e.g., `~/.zshrc`):

```bash
export FIGMA_ACCESS_TOKEN=your_token_here
```

4. Reload your shell (`source ~/.zshrc`) or open a new terminal
5. Run the publish command:

```bash
npx figma connect publish
```

To find which components are already mapped, search for `parameters.design` in `app/stories/`.

## Troubleshooting

**MCP returns "unauthorized" or prompts for auth repeatedly:**
Re-authenticate by running `claude mcp list` and verifying the figma server is
connected. For Cursor, check Settings > MCP for connection status.

**`get_design_context` output is too large:**
Use `get_metadata` first to get the node tree, then call `get_design_context`
on specific child nodes rather than the entire component frame.

**`send_code_connect_mappings` fails with "Published component not found":**
The Figma component must be published to a team library. Components that are
only local to the file will not work.

**`send_code_connect_mappings` fails with plan/permissions error:**
Code Connect requires a Figma Organization or Enterprise plan. We have this.
Ensure that you're using the correct (Arize) Figma account.

## References

- [Figma MCP Server Docs](https://developers.figma.com/docs/figma-mcp-server/)
- [Figma MCP Tools and Prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)
- [Code Connect with Storybook](https://developers.figma.com/docs/code-connect/storybook/)
- [Storybook Design Integrations](https://storybook.js.org/docs/sharing/design-integrations)
