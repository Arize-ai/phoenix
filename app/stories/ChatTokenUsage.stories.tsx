import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "@phoenix/components";
import { ChatTokenUsage } from "@phoenix/components/agent/ChatTokenUsage";

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
