import { css } from "@emotion/react";
import type { Meta } from "@storybook/react";

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

const meta = {
  title: "Domains/PXI/Solve with PXI/Compositions",
  tags: ["legacy", "unreviewed"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

const pxiMenuGlyphCSS = css`
  color: var(--ai-gradient-color-middle);
`;

export const MenuAction = {
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

export const ActionCluster = {
  render: () => (
    <ActionClusterExample isPxiButtonIconOnly pxiButtonVariant="default" />
  ),
};

export const QuietActionCluster = {
  render: () => (
    <ActionClusterExample
      isPxiButtonIconOnly={false}
      pxiButtonVariant="quiet"
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  // Anchored at the top left, the menu opens down and right into the frame.
  render: () => (
    <div style={{ alignSelf: "flex-start", marginRight: "auto" }}>
      <MenuTrigger defaultOpen>
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
    </div>
  ),
};
