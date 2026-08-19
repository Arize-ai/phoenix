import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

import type { VersionUpdateNoticeItemProps } from "@phoenix/components/nav/VersionUpdateNotice";
import { VersionUpdateNoticeItem } from "@phoenix/components/nav/VersionUpdateNotice";

/**
 * Mimics the expanded side nav surface the notice renders inside of
 */
const sideNavFrameCSS = css`
  box-sizing: border-box;
  width: var(--nav-expanded-width);
  padding: var(--global-dimension-size-200) var(--global-dimension-size-100);
  background-color: var(--global-color-gray-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;

const meta = {
  title: "Nav/VersionUpdateNotice",
  component: VersionUpdateNoticeItem,
  parameters: {
    docs: {
      description: {
        component:
          "Dismissable card shown at the bottom of the expanded side nav when the running Phoenix server has fallen at least two minor versions (or a major version) behind the latest PyPI release. Links to the GitHub release for the new version.",
      },
    },
  },
  args: {
    latestVersion: "12.0.0",
    onDismiss: fn(),
  },
  decorators: [
    (Story) => (
      <div css={sideNavFrameCSS}>
        <ul>
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta<typeof VersionUpdateNoticeItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongVersion: Story = {
  args: {
    latestVersion: "1000.2000.3000rc10",
  },
};

function DismissableRender(args: VersionUpdateNoticeItemProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  if (isDismissed) {
    return null;
  }
  return (
    <VersionUpdateNoticeItem
      {...args}
      onDismiss={() => {
        args.onDismiss();
        setIsDismissed(true);
      }}
    />
  );
}

export const Dismissable: Story = {
  render: (args) => <DismissableRender {...args} />,
};
