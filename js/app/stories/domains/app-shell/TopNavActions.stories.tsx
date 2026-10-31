import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Button, Flex, Text } from "@phoenix/components";
import {
  TopNavActions,
  TopNavActionsProvider,
  TopNavActionsSlot,
} from "@phoenix/components/nav";

const navPreviewCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100);
  background-color: var(--global-color-gray-100);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  min-width: 480px;
`;

const pageBodyCSS = css`
  margin-top: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  border: 1px dashed var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

export default {
  title: "Domains/App shell/Top Nav Actions",
  tags: ["legacy", "unreviewed"],
  component: TopNavActions,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof TopNavActions>;

const Shell = ({ children }: { children: React.ReactNode }) => (
  <TopNavActionsProvider>
    <Flex direction="column">
      <nav css={navPreviewCSS}>
        <Text weight="heavy">Breadcrumbs</Text>
        <TopNavActionsSlot />
      </nav>
      <div css={pageBodyCSS}>{children}</div>
    </Flex>
  </TopNavActionsProvider>
);

export const Empty: StoryFn = () => (
  <Shell>
    <Text>No page-declared actions. Slot renders nothing.</Text>
  </Shell>
);

export const SingleAction: StoryFn = () => (
  <Shell>
    <Text>Page body declares one action (rendered top-right).</Text>
    <TopNavActions>
      <Button variant="primary">Time Range</Button>
    </TopNavActions>
  </Shell>
);

export const MultipleContributors: StoryFn = () => (
  <Shell>
    <Text>
      Two components each declare actions — both render side-by-side in the nav
      slot.
    </Text>
    <TopNavActions>
      <Button>Filter</Button>
    </TopNavActions>
    <TopNavActions>
      <Button variant="primary">Time Range</Button>
    </TopNavActions>
  </Shell>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  // The nav preview is wider than the frame at 1:1.
  parameters: { thumbnail: { scale: 0.5 } },
  render: MultipleContributors,
};
