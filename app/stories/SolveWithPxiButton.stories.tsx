import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button, Flex, Text } from "@phoenix/components";
import { SolveWithPxiButton } from "@phoenix/components/agent/SolveWithPxiButton";

const meta = {
  title: "Agent/Solve with PXI/Button",
  component: SolveWithPxiButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PXI-specific action composed from Phoenix's core Button. It supports the default and quiet variants at small and medium sizes.",
      },
    },
  },
  args: {
    label: "Solve with PXI",
    size: "M",
    variant: "default",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["S", "M"],
    },
    variant: {
      control: "inline-radio",
      options: ["default", "quiet"],
    },
  },
} satisfies Meta<typeof SolveWithPxiButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function SizesAndVariantsExample({
  shouldFlash = false,
}: {
  shouldFlash?: boolean;
}) {
  return (
    <Flex direction="column" gap="size-300">
      <Flex direction="column" gap="size-100">
        <Text size="XS" color="text-500">
          Default
        </Text>
        <Flex direction="row" gap="size-200" alignItems="center">
          <SolveWithPxiButton size="S" shouldFlash={shouldFlash} />
          <SolveWithPxiButton size="M" shouldFlash={shouldFlash} />
          <SolveWithPxiButton size="S" isIconOnly shouldFlash={shouldFlash} />
          <SolveWithPxiButton size="M" isIconOnly shouldFlash={shouldFlash} />
        </Flex>
      </Flex>
      <Flex direction="column" gap="size-100">
        <Text size="XS" color="text-500">
          Quiet
        </Text>
        <Flex direction="row" gap="size-200" alignItems="center">
          <SolveWithPxiButton
            size="S"
            variant="quiet"
            shouldFlash={shouldFlash}
          />
          <SolveWithPxiButton
            size="M"
            variant="quiet"
            shouldFlash={shouldFlash}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

export const SizesAndVariants: Story = {
  render: () => <SizesAndVariantsExample />,
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

const attentionStoryCSS = css`
  min-width: 320px;
`;

function AttentionFlashExample() {
  const [flashKey, setFlashKey] = useState(0);
  return (
    <Flex
      direction="column"
      gap="size-300"
      alignItems="center"
      css={attentionStoryCSS}
    >
      <div key={flashKey}>
        <SizesAndVariantsExample shouldFlash />
      </div>
      <Button size="S" onPress={() => setFlashKey((value) => value + 1)}>
        Replay flash
      </Button>
    </Flex>
  );
}

export const AttentionFlash: Story = {
  render: () => <AttentionFlashExample />,
};
