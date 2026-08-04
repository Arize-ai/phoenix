import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  Button,
  Card,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import {
  PxiOutline,
  type PxiOutlineProps,
  type PxiOutlineState,
} from "@phoenix/components/agent/PxiOutline";

const meta = {
  title: "Agent/Solve with PXI/Outline",
  component: PxiOutline,
  parameters: {
    width: 720,
    docs: {
      description: {
        component:
          "Conic PXI outline for marking controls and surfaces as AI-enabled. Eligible outlines may optionally flash once; active outlines remain animated.",
      },
    },
  },
  args: {
    children: <Button size="S">Hallucination evaluator</Button>,
    glowMode: "outer",
    isFullWidth: false,
    radius: "small",
    shouldFlash: false,
    state: "idle",
  },
  argTypes: {
    glowMode: {
      control: "inline-radio",
      options: ["outer", "contained"],
    },
    radius: {
      control: "inline-radio",
      options: ["small", "medium"],
    },
    state: {
      control: "inline-radio",
      options: ["idle", "eligible", "active"],
    },
  },
} satisfies Meta<typeof PxiOutline>;

export default meta;
type Story = StoryObj<typeof meta>;

const outlineFrameCSS = css`
  padding: var(--global-dimension-static-size-300);
`;

const stateLabelCSS = css`
  text-transform: capitalize;
`;

const outlineStates: PxiOutlineState[] = ["idle", "eligible", "active"];

export const States: Story = {
  render: () => (
    <Flex direction="column" gap="size-300" css={outlineFrameCSS}>
      {outlineStates.map((state) => (
        <Flex key={state} direction="column" gap="size-100">
          <Text size="XS" color="text-500" css={stateLabelCSS}>
            {state}
          </Text>
          <PxiOutline state={state}>
            <Button size="S">Hallucination evaluator</Button>
          </PxiOutline>
        </Flex>
      ))}
    </Flex>
  ),
};

export const SelectTrigger: Story = {
  render: (args) => (
    <div css={outlineFrameCSS}>
      <PxiOutline {...args}>
        <Select
          size="S"
          aria-label="Evaluator"
          defaultSelectedKey="hallucination"
        >
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              <SelectItem id="hallucination" textValue="Hallucination">
                Hallucination
              </SelectItem>
              <SelectItem id="relevance" textValue="Relevance">
                Relevance
              </SelectItem>
              <SelectItem id="toxicity" textValue="Toxicity">
                Toxicity
              </SelectItem>
            </ListBox>
          </Popover>
        </Select>
      </PxiOutline>
    </div>
  ),
};

export const FullWidthPanel: Story = {
  args: {
    isFullWidth: true,
    radius: "medium",
    state: "eligible",
  },
  render: (args) => (
    <div css={outlineFrameCSS}>
      <PxiOutline {...args}>
        <Card title="Output">
          <View padding="size-200">
            The response cites a source that was not present in the retrieved
            documents.
          </View>
        </Card>
      </PxiOutline>
    </div>
  ),
};

function EligibleFlashExample(props: PxiOutlineProps) {
  const [flashKey, setFlashKey] = useState(0);
  return (
    <Flex direction="column" gap="size-300" css={outlineFrameCSS}>
      <PxiOutline {...props} key={flashKey} state="eligible" shouldFlash>
        <Button size="S">Hallucination evaluator</Button>
      </PxiOutline>
      <Button
        size="S"
        onPress={() => setFlashKey((value) => value + 1)}
        css={css`
          align-self: flex-start;
        `}
      >
        Replay flash
      </Button>
    </Flex>
  );
}

export const EligibleAttentionFlash: Story = {
  render: (args) => <EligibleFlashExample {...args} />,
};

const clippedRowCSS = css`
  width: 100%;
  height: 44px;
  padding: 0 var(--global-dimension-static-size-100);
  display: flex;
  align-items: center;
  gap: var(--global-dimension-static-size-200);
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
`;

export const ClippedRow: Story = {
  render: () => <ClippedRowExample />,
};

function ClippedRowExample() {
  const [flashKey, setFlashKey] = useState(0);
  return (
    <Flex direction="column" gap="size-300" css={outlineFrameCSS}>
      <Flex key={flashKey} direction="column" gap="size-300">
        <Flex direction="column" gap="size-100">
          <Text size="XS" color="text-500">
            Glow modes inside overflow: hidden
          </Text>
          <div css={clippedRowCSS}>
            <PxiOutline glowMode="outer" state="eligible" shouldFlash>
              <Button size="S">Outer glow</Button>
            </PxiOutline>
            <PxiOutline glowMode="contained" state="eligible" shouldFlash>
              <Button size="S">Contained glow</Button>
            </PxiOutline>
          </div>
        </Flex>
        <Flex direction="column" gap="size-100">
          <Text size="XS" color="text-500">
            Glow modes with overflow visible
          </Text>
          <Flex gap="size-200">
            <PxiOutline glowMode="outer" state="eligible" shouldFlash>
              <Button size="S">Outer glow</Button>
            </PxiOutline>
            <PxiOutline glowMode="contained" state="eligible" shouldFlash>
              <Button size="S">Contained glow</Button>
            </PxiOutline>
          </Flex>
        </Flex>
      </Flex>
      <Button
        size="S"
        onPress={() => setFlashKey((value) => value + 1)}
        css={css`
          align-self: flex-start;
        `}
      >
        Replay flash
      </Button>
    </Flex>
  );
}
