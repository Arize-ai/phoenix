import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  Button,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import {
  PxiButton,
  type PxiButtonVariant,
} from "@phoenix/components/agent/PxiButton";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";

/**
 * The "Solve with PXI" action: the `PxiButton` itself, then the places it is
 * composed into other surfaces — a menu item that carries the PXI glyph, and
 * a span header's action cluster beside Annotate and Copy.
 */
const meta = {
  title: "Domains/PXI/Solve with PXI",
  tags: ["legacy", "unreviewed"],
  component: PxiButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The Solve with PXI action. `PxiButton` is composed from Phoenix's core Button and supports default and quiet variants, attention flashes, and a continuous thinking state. The Menu Action and Action Cluster stories show how it sits among other actions.",
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

const pxiMenuGlyphCSS = css`
  color: var(--ai-gradient-color-middle);
`;

export const MenuAction: Story = {
  render: () => (
    <MenuTrigger>
      <Button>Open span actions</Button>
      <Popover>
        <Menu aria-label="Span actions">
          <MenuItem
            textValue="View trace"
            leadingContent={<Icon svg={<Icons.List />} />}
          >
            View trace
          </MenuItem>
          <MenuItem
            textValue="Copy span ID"
            leadingContent={<Icon svg={<Icons.Duplicate />} />}
          >
            Copy span ID
          </MenuItem>
          <MenuItem
            textValue="Solve with PXI"
            leadingContent={
              <span css={pxiMenuGlyphCSS} aria-hidden="true">
                <PxiGlyph size={15} />
              </span>
            }
          >
            Solve with PXI
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  ),
};

function ActionClusterExample({
  isPxiButtonIconOnly,
  pxiButtonVariant,
}: {
  isPxiButtonIconOnly: boolean;
  pxiButtonVariant: PxiButtonVariant;
}) {
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap="size-300"
      minWidth="520px"
    >
      <Flex direction="column" gap="size-25">
        <Text>ChatCompletion</Text>
        <Text size="XS" color="text-500">
          LLM · 4.2s · 1,204 tokens · error
        </Text>
      </Flex>
      <Flex direction="row" alignItems="center" gap="size-100" flex="none">
        <Button size="S" leadingVisual={<Icon svg={<Icons.Edit />} />}>
          Annotate
        </Button>
        <CopyToClipboardButton
          size="S"
          text="span-8f2ac1"
          tooltipText="Copy Span ID"
        />
        <TooltipTrigger>
          <PxiButton
            size="S"
            isIconOnly={isPxiButtonIconOnly}
            variant={pxiButtonVariant}
          />
          <Tooltip>Solve with PXI</Tooltip>
        </TooltipTrigger>
      </Flex>
    </Flex>
  );
}

export const ActionCluster: Story = {
  render: () => (
    <ActionClusterExample isPxiButtonIconOnly pxiButtonVariant="default" />
  ),
};

export const QuietActionCluster: Story = {
  render: () => (
    <ActionClusterExample
      isPxiButtonIconOnly={false}
      pxiButtonVariant="quiet"
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  ...SizesAndVariants,
  tags: ["!dev", "!autodocs"],
  // The row of sizes is slightly wider than the frame at 1:1.
  parameters: { thumbnail: { scale: 0.7 } },
};
