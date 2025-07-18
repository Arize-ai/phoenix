import type { Meta, StoryObj } from "@storybook/react";

import { Button, Icon, Icons } from "@phoenix/components";
import {
  RichTooltip,
  RichTooltipActions,
  RichTooltipDescription,
  RichTooltipProps,
  RichTooltipTitle,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";

/**
 * RichTooltips display structured, detailed information when users hover over, focus on, or tap an element.
 * They provide contextual information with titles, descriptions, and optional actions for complex interfaces.
 * Unlike regular tooltips, rich tooltips can contain formatted content and interactive elements using composition.
 */
const meta = {
  title: "RichTooltip",
  component: RichTooltip,
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
  },
} satisfies Meta<typeof RichTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A rich tooltip with both title and description provides comprehensive context.
 */
export const Default: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Rich tooltip</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Rich tooltip</RichTooltipTitle>
        <RichTooltipDescription>
          Rich tooltips bring attention to a particular element or feature that
          warrants the user&apos;s focus.
        </RichTooltipDescription>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips can display just a title for simple structured content.
 */
export const TitleOnly: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Title only</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Important Feature</RichTooltipTitle>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips can display just a description for detailed explanations.
 */
export const DescriptionOnly: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Description only</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipDescription>
          This is a detailed explanation of the feature or functionality that
          provides comprehensive context to help users understand what this
          element does.
        </RichTooltipDescription>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips can include action buttons for interactive functionality.
 */
export const WithActions: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>With actions</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Feature Tutorial</RichTooltipTitle>
        <RichTooltipDescription>
          Learn more about this feature and how to use it effectively.
        </RichTooltipDescription>
        <RichTooltipActions>
          <Button size="S">Learn More</Button>
        </RichTooltipActions>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips can contain multiple action buttons.
 */
export const MultipleActions: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Multiple actions</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Unsaved Changes</RichTooltipTitle>
        <RichTooltipDescription>
          You have unsaved changes. What would you like to do?
        </RichTooltipDescription>
        <RichTooltipActions>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="S" variant="primary">
              Save
            </Button>
            <Button size="S" variant="quiet">
              Discard
            </Button>
          </div>
        </RichTooltipActions>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips work well with icon buttons for explanatory content.
 */
export const WithIconButton: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button variant="quiet" size="S">
        <Icon svg={<Icons.InfoOutline />} />
      </Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Data Privacy</RichTooltipTitle>
        <RichTooltipDescription>
          Your data is encrypted and stored securely. We never share your
          information with third parties.
        </RichTooltipDescription>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips can be positioned on different sides of the trigger element.
 */
export const DifferentPlacements: Story = {
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
        <RichTooltip placement="top">
          <TooltipArrow />
          <RichTooltipTitle>Top Placement</RichTooltipTitle>
          <RichTooltipDescription>
            This tooltip appears above the trigger
          </RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>
      <div></div>

      {/* Middle row */}
      <TooltipTrigger>
        <Button size="S">Left</Button>
        <RichTooltip placement="left">
          <TooltipArrow />
          <RichTooltipTitle>Left Placement</RichTooltipTitle>
          <RichTooltipDescription>
            This tooltip appears to the left
          </RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>
      <div></div>
      <TooltipTrigger>
        <Button size="S">Right</Button>
        <RichTooltip placement="right">
          <TooltipArrow />
          <RichTooltipTitle>Right Placement</RichTooltipTitle>
          <RichTooltipDescription>
            This tooltip appears to the right
          </RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>

      {/* Bottom row */}
      <div></div>
      <TooltipTrigger>
        <Button size="S">Bottom</Button>
        <RichTooltip placement="bottom">
          <TooltipArrow />
          <RichTooltipTitle>Bottom Placement</RichTooltipTitle>
          <RichTooltipDescription>
            This tooltip appears below the trigger
          </RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>
      <div></div>
    </div>
  ),
};

/**
 * Rich tooltips can display longer content that wraps appropriately.
 */
export const LongContent: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Long content</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Comprehensive Feature Guide</RichTooltipTitle>
        <RichTooltipDescription>
          This is a comprehensive explanation of a complex feature that requires
          multiple sentences to fully describe. The tooltip will automatically
          wrap the content to maintain readability while staying within the
          maximum width constraints. This helps users understand complex
          functionality without overwhelming the interface.
        </RichTooltipDescription>
        <RichTooltipActions>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="S" variant="primary">
              Get Started
            </Button>
            <Button size="S" variant="quiet">
              Learn More
            </Button>
          </div>
        </RichTooltipActions>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Rich tooltips support full composition flexibility with custom content.
 */
export const CustomComposition: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Custom content</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <div>
          <strong>Custom Content</strong>
          <br />
          You can provide any custom content as children when you need more
          control over the tooltip structure.
        </div>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};

/**
 * Example matching the provided design with cost breakdown.
 */
export const CostBreakdown: Story = {
  render: (args: RichTooltipProps) => (
    <TooltipTrigger>
      <Button>Total cost</Button>
      <RichTooltip {...args}>
        <TooltipArrow />
        <RichTooltipTitle>Total</RichTooltipTitle>
        <RichTooltipDescription>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🟣 Prompt</span>
              <span>$0.23</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🟠 Tool</span>
              <span>$0.46</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🔵 Completion</span>
              <span>$1.08</span>
            </div>
          </div>
        </RichTooltipDescription>
        <RichTooltipActions>
          <Button size="S" variant="quiet">
            Action
          </Button>
        </RichTooltipActions>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};
