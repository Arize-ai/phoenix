import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { Button, Text } from "@phoenix/components";
import {
  ChatTokenUsage,
  ChatTokenUsageDetails,
} from "@phoenix/components/agent/ChatTokenUsage";

const meta = {
  title: "Agent/Chat Token Usage",
  component: ChatTokenUsage,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: "426px" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    total: 33_200,
    prompt: 32_000,
    completion: 1_200,
  },
} satisfies Meta<typeof ChatTokenUsage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The persistent footer shows only the total token count. */
export const Default: Story = {};

/** Clicking the token count reveals the in-flow Prompt/Completion breakdown. */
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "33,200 total tokens" })
    );
    await expect(
      canvas.getByRole("region", { name: "Token usage breakdown" })
    ).toBeVisible();
  },
};

/** Hovering or focusing the Prompt legend shows its uncached, cache-read, and cache-write composition in a tooltip. */
export const ExpandedWithPromptDetails: Story = {
  args: {
    promptDetails: {
      cacheRead: 21_000,
      cacheWrite: 3_000,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "33,200 total tokens" })
    );
    await userEvent.hover(
      canvas.getByRole("button", {
        name: "32,000 prompt tokens. Show cache details",
      })
    );
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole(
      "tooltip"
    );
    await expect(within(tooltip).getByText("8.0K Uncached")).toBeVisible();
    await expect(within(tooltip).getByText("21K Cache read")).toBeVisible();
    await expect(within(tooltip).getByText("3.0K Cache write")).toBeVisible();
  },
};

/** Prompt-detail states keep the base Prompt/Completion view when no cache data exists. */
export const PromptDetailScenarios: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "32px",
        width: "426px",
      }}
    >
      <TokenUsageScenario label="Cache read and write">
        <ChatTokenUsageDetails
          total={33_200}
          prompt={32_000}
          completion={1_200}
          promptDetails={{ cacheRead: 21_000, cacheWrite: 3_000 }}
        />
      </TokenUsageScenario>
      <TokenUsageScenario label="Cache read only">
        <ChatTokenUsageDetails
          total={33_200}
          prompt={32_000}
          completion={1_200}
          promptDetails={{ cacheRead: 27_000, cacheWrite: 0 }}
        />
      </TokenUsageScenario>
      <TokenUsageScenario label="Cache write only">
        <ChatTokenUsageDetails
          total={33_200}
          prompt={32_000}
          completion={1_200}
          promptDetails={{ cacheRead: 0, cacheWrite: 5_000 }}
        />
      </TokenUsageScenario>
      <TokenUsageScenario label="Fully cached prompt">
        <ChatTokenUsageDetails
          total={33_200}
          prompt={32_000}
          completion={1_200}
          promptDetails={{ cacheRead: 32_000, cacheWrite: 0 }}
        />
      </TokenUsageScenario>
      <TokenUsageScenario label="No prompt details">
        <ChatTokenUsageDetails
          total={33_200}
          prompt={32_000}
          completion={1_200}
        />
      </TokenUsageScenario>
    </div>
  ),
};

/** The chart spans both metadata columns without moving their first-row alignment. */
export const WithApprovalControl: Story = {
  render: (args) => (
    <div
      style={{
        alignItems: "center",
        columnGap: "8px",
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        width: "100%",
      }}
    >
      <Button size="S">Ask before edits</Button>
      <ChatTokenUsage {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "33,200 total tokens" })
    );
    await expect(
      canvas.getByRole("region", { name: "Token usage breakdown" })
    ).toBeVisible();
  },
};

function TokenUsageScenario({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Text size="XS" css={{ marginBottom: "8px" }}>
        {label}
      </Text>
      {children}
    </section>
  );
}
