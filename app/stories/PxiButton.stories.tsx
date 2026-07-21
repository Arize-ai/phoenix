import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button, Flex, Text } from "@phoenix/components";
import { PxiButton } from "@phoenix/components/agent/PxiButton";

const meta = {
  title: "Agent/Solve with PXI/Button",
  component: PxiButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PXI-specific action composed from Phoenix's core Button. It supports default and quiet variants, attention flashes, and a continuous thinking state.",
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
} satisfies Meta<typeof PxiButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
          <PxiButton size="S" shouldFlash={shouldFlash} />
          <PxiButton size="M" shouldFlash={shouldFlash} />
          <PxiButton size="S" isIconOnly shouldFlash={shouldFlash} />
          <PxiButton size="M" isIconOnly shouldFlash={shouldFlash} />
        </Flex>
      </Flex>
      <Flex direction="column" gap="size-100">
        <Text size="XS" color="text-500">
          Quiet
        </Text>
        <Flex direction="row" gap="size-200" alignItems="center">
          <PxiButton size="S" variant="quiet" shouldFlash={shouldFlash} />
          <PxiButton size="M" variant="quiet" shouldFlash={shouldFlash} />
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

export const Thinking: Story = {
  args: {
    label: "Ask PXI",
    isThinking: true,
    size: "S",
    variant: "quiet",
  },
};

const glowEffectStoryCSS = css`
  min-width: 320px;
`;

function GlowEffectExample() {
  const [flashKey, setFlashKey] = useState(0);
  return (
    <Flex
      direction="column"
      gap="size-300"
      alignItems="center"
      css={glowEffectStoryCSS}
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

export const GlowEffect: Story = {
  name: "Glow effect",
  render: () => <GlowEffectExample />,
};
