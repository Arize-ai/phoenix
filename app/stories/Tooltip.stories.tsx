import type { Meta, StoryObj } from "@storybook/react";

import { Button, Icon, Icons } from "@phoenix/components";
import {
  Tooltip,
  TooltipArrow,
  TooltipProps,
  TooltipTrigger,
} from "@phoenix/components/tooltip";

/**
 * Tooltips display helpful information when users hover over, focus on, or tap an element.
 * They provide contextual information without cluttering the interface and are fully accessible.
 * The tooltip component wraps react-aria-components' Tooltip with Phoenix design system styling.
 */
const meta = {
  title: "Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    placement: {
      control: "select",
      options: [
        "top",
        "bottom",
        "left",
        "right",
        "top start",
        "top end",
        "bottom start",
        "bottom end",
        "left top",
        "left bottom",
        "right top",
        "right bottom",
      ],
      description:
        "The placement of the tooltip relative to the trigger element",
      defaultValue: "top",
    },
    offset: {
      control: "number",
      description: "The offset distance from the trigger element",
      defaultValue: 8,
    },
    crossOffset: {
      control: "number",
      description: "The cross-axis offset from the trigger element",
      defaultValue: 0,
    },
    isEntering: {
      control: "boolean",
      description: "Whether the tooltip is in the entering animation state",
      defaultValue: false,
    },
    isExiting: {
      control: "boolean",
      description: "Whether the tooltip is in the exiting animation state",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default tooltip shows helpful information when hovering over a trigger element.
 */
export const Default: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Hover me</Button>
      <Tooltip {...args}>This is a helpful tooltip</Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Tooltips can include an arrow pointing to the trigger element for better visual connection.
 */
export const WithArrow: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Hover for tooltip with arrow</Button>
      <Tooltip {...args}>
        <TooltipArrow />
        This tooltip has an arrow pointing to the trigger
      </Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Tooltips can be positioned on different sides of the trigger element.
 */
export const TopPlacement: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Top tooltip</Button>
      <Tooltip {...args}>Tooltip positioned above the trigger</Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

export const BottomPlacement: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Bottom tooltip</Button>
      <Tooltip {...args}>Tooltip positioned below the trigger</Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "bottom",
  },
};

export const LeftPlacement: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Left tooltip</Button>
      <Tooltip {...args}>Tooltip positioned to the left</Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "left",
  },
};

export const RightPlacement: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Right tooltip</Button>
      <Tooltip {...args}>Tooltip positioned to the right</Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "right",
  },
};

/**
 * Tooltips work with different types of trigger elements, not just buttons.
 */
export const WithIconButton: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button variant="quiet" size="S">
        <Icon svg={<Icons.InfoOutline />} />
      </Button>
      <Tooltip {...args}>
        <TooltipArrow />
        This tooltip explains what the info icon does
      </Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Tooltips can contain longer text content that will wrap appropriately.
 */
export const LongContent: Story = {
  render: (args: TooltipProps) => (
    <TooltipTrigger>
      <Button>Long tooltip content</Button>
      <Tooltip {...args}>
        This is a longer tooltip that demonstrates how the component handles
        multiple lines of text. The tooltip will wrap content appropriately
        within its maximum width constraints.
      </Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Multiple tooltips can be used together. They support global delay behavior
 * where subsequent tooltips show immediately after the first one.
 */
export const MultipleTooltips: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <TooltipTrigger>
        <Button size="S">First</Button>
        <Tooltip placement="top">First tooltip</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <Button size="S">Second</Button>
        <Tooltip placement="top">Second tooltip</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <Button size="S">Third</Button>
        <Tooltip placement="top">Third tooltip</Tooltip>
      </TooltipTrigger>
    </div>
  ),
};

/**
 * Demonstration of all available placements in a grid layout.
 */
export const AllPlacements: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 120px)",
        gap: "50px",
        padding: "100px",
        justifyItems: "center",
      }}
    >
      {/* Top row */}
      <div></div>
      <TooltipTrigger>
        <Button size="S">Top</Button>
        <Tooltip placement="top">Top placement</Tooltip>
      </TooltipTrigger>
      <div></div>

      {/* Middle row */}
      <TooltipTrigger>
        <Button size="S">Left</Button>
        <Tooltip placement="left">Left placement</Tooltip>
      </TooltipTrigger>
      <div></div>
      <TooltipTrigger>
        <Button size="S">Right</Button>
        <Tooltip placement="right">Right placement</Tooltip>
      </TooltipTrigger>

      {/* Bottom row */}
      <div></div>
      <TooltipTrigger>
        <Button size="S">Bottom</Button>
        <Tooltip placement="bottom">Bottom placement</Tooltip>
      </TooltipTrigger>
      <div></div>
    </div>
  ),
};

/**
 * Demonstration of tooltips with arrows on all placements.
 */
export const AllPlacementsWithArrows: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 120px)",
        gap: "50px",
        padding: "100px",
        justifyItems: "center",
      }}
    >
      {/* Top row */}
      <div></div>
      <TooltipTrigger>
        <Button size="S">Top</Button>
        <Tooltip placement="top">
          <TooltipArrow />
          Top with arrow
        </Tooltip>
      </TooltipTrigger>
      <div></div>

      {/* Middle row */}
      <TooltipTrigger>
        <Button size="S">Left</Button>
        <Tooltip placement="left">
          <TooltipArrow />
          Left with arrow
        </Tooltip>
      </TooltipTrigger>
      <div></div>
      <TooltipTrigger>
        <Button size="S">Right</Button>
        <Tooltip placement="right">
          <TooltipArrow />
          Right with arrow
        </Tooltip>
      </TooltipTrigger>

      {/* Bottom row */}
      <div></div>
      <TooltipTrigger>
        <Button size="S">Bottom</Button>
        <Tooltip placement="bottom">
          <TooltipArrow />
          Bottom with arrow
        </Tooltip>
      </TooltipTrigger>
      <div></div>
    </div>
  ),
};
