import type { Meta, StoryFn } from "@storybook/react";

import type { CopyActionMenuProps } from "@phoenix/components";
import { CopyActionMenu, View } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Actions/Copy Action Menu",
  component: CopyActionMenu,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<CopyActionMenuProps> = (args) => (
  <CopyActionMenu {...args} />
);

export const Default = Template.bind({});
Default.args = {
  items: [
    { name: "Project Name", value: "my-project", iconKey: "TextOutline" },
    { name: "Project ID", value: "proj_abc123", iconKey: "IDOutline" },
  ],
};

export const WithoutIcons = Template.bind({});
WithoutIcons.args = {
  items: [
    { name: "Name", value: "example-name" },
    { name: "ID", value: "id_12345" },
  ],
};

export const SingleItem = Template.bind({});
SingleItem.args = {
  items: [{ name: "API Key", value: "sk-abc123", iconKey: "KeyOutline" }],
};

export const ManyItems: StoryFn = () => (
  <View padding="size-200">
    <CopyActionMenu
      items={[
        { name: "Dataset Name", value: "eval-dataset", iconKey: "TextOutline" },
        { name: "Dataset ID", value: "ds_xyz789", iconKey: "IDOutline" },
        { name: "Version", value: "v1.2.3", iconKey: "GitBranchOutline" },
        {
          name: "Created At",
          value: "2025-01-15T10:30:00Z",
          iconKey: "CalendarOutline",
        },
      ]}
    />
  </View>
);
