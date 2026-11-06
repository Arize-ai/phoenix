import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import type { CopyActionMenuProps } from "@phoenix/components";
import { CopyActionMenu, View } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Actions/Copy Action Menu",
  tags: ["legacy", "unreviewed"],
  component: CopyActionMenu,
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default: StoryObj<CopyActionMenuProps> = {
  tags: ["!dev"],
  args: {
    items: [
      { name: "Project Name", value: "my-project", iconKey: "Text" },
      { name: "Project ID", value: "proj_abc123", iconKey: "ID" },
    ],
  },
};

export const WithoutIcons = {
  tags: ["!dev"],
  args: {
    items: [
      { name: "Name", value: "example-name" },
      { name: "ID", value: "id_12345" },
    ],
  },
};

export const SingleItem = {
  tags: ["!dev"],
  args: {
    items: [{ name: "API Key", value: "sk-abc123", iconKey: "Key" }],
  },
};

export const ManyItems: StoryFn = () => (
  <View padding="size-200">
    <CopyActionMenu
      items={[
        { name: "Dataset Name", value: "eval-dataset", iconKey: "Text" },
        { name: "Dataset ID", value: "ds_xyz789", iconKey: "ID" },
        { name: "Version", value: "v1.2.3", iconKey: "GitBranch" },
        {
          name: "Created At",
          value: "2025-01-15T10:30:00Z",
          iconKey: "Calendar",
        },
      ]}
    />
  </View>
);

ManyItems.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<CopyActionMenuProps> = {
  tags: ["!dev", "!autodocs"],
  args: Default.args,
  render: (args) => (
    <div style={{ alignSelf: "flex-start", marginInlineStart: 120 }}>
      <CopyActionMenu items={args.items} />
    </div>
  ),
  // There is no open prop; press the trigger, as a pointer would.
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Copy" })
    );
  },
};
