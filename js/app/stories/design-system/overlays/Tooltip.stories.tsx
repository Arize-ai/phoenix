import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties, ReactNode } from "react";

import { Button, Flex, Icon, Icons, Link, Text } from "@phoenix/components";
import type {
  RichTooltipProps,
  TooltipProps,
} from "@phoenix/components/core/tooltip";
import {
  RichTooltip,
  RichTooltipActions,
  RichTooltipDescription,
  RichTooltipTitle,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/core/tooltip";

/**
 * Tooltips show supplementary information about the element they are
 * attached to when a user hovers or focuses it. Phoenix has two tooltip
 * surfaces that share one trigger, `TooltipTrigger`, and one arrow,
 * `TooltipArrow`:
 *
 * - **`Tooltip`** is for a short sentence. It is capped at 200px wide and is
 *   never interactive (`pointer-events: none`), so a lingering tooltip cannot
 *   intercept a click aimed at the control beneath it.
 * - **`RichTooltip`** is for structured content: a title, a description, a
 *   list, a breakdown, or actions. It grows to 300px unless given a `width`,
 *   keeps pointer events so its content can be hovered and pressed, and is
 *   composed from `RichTooltipTitle`, `RichTooltipDescription` and
 *   `RichTooltipActions`.
 *
 * Choose `Tooltip` whenever the content fits in a sentence; reach for
 * `RichTooltip` only when the content has structure.
 *
 * The content stories hold every tooltip open through `TooltipTrigger`'s
 * controlled `isOpen` prop, so hovering or leaving a trigger does not dismiss
 * it. Control it on the trigger, not on `Tooltip`: a tooltip given its own
 * `isOpen` inside a `TooltipTrigger` renders but is never positioned. They
 * place tooltips to the `right` so a stack stays readable; production
 * tooltips default to `top`. `Placements` shows every side, and
 * `Interaction` shows how triggers open and close them.
 */
const meta = {
  title: "Design System/Overlays/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
    themeLayout: "column",
  },
  tags: ["updated", "unreviewed", "incomplete"],
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
    },
    offset: {
      control: "number",
      description: "The offset distance from the trigger element",
    },
    crossOffset: {
      control: "number",
      description: "The cross-axis offset from the trigger element",
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One labeled row of a stack. `height` reserves room for the open tooltip,
 * which is portaled and so takes no space in the layout itself.
 */
function Case({
  label,
  height = 56,
  children,
}: {
  label: string;
  height?: CSSProperties["height"];
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px auto",
        alignItems: "center",
        justifyItems: "start",
        height,
      }}
    >
      <Text size="S" color="text-700">
        {label}
      </Text>
      <div>{children}</div>
    </div>
  );
}

function Stack({ children }: { children: ReactNode }) {
  return <div style={{ width: 640 }}>{children}</div>;
}

/**
 * The plain `Tooltip`: a short sentence, with or without an arrow, attached
 * to the triggers Phoenix uses it on. Icon-only buttons are the most common
 * trigger and need an `aria-label`. Text, badges and other non-focusable
 * content become a trigger through `TriggerWrap`, which makes them focusable
 * so keyboard users can reach the tooltip too.
 */
export const PlainTooltip: Story = {
  name: "Tooltip",
  args: { placement: "right" },
  render: (args: TooltipProps) => (
    <Stack>
      <Case label="Text">
        <TooltipTrigger isOpen>
          <Button size="S">Hover me</Button>
          <Tooltip {...args}>This is a helpful tooltip</Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="With arrow">
        <TooltipTrigger isOpen>
          <Button size="S">Hover me</Button>
          <Tooltip {...args}>
            <TooltipArrow />
            This tooltip has an arrow pointing to the trigger
          </Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Icon button trigger">
        <TooltipTrigger isOpen>
          <Button
            variant="quiet"
            size="S"
            aria-label="Info"
            leadingVisual={<Icon svg={<Icons.Info />} />}
          />
          <Tooltip {...args}>
            <TooltipArrow />
            This tooltip explains what the info icon does
          </Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Non-focusable trigger (TriggerWrap)">
        <TooltipTrigger isOpen>
          <TriggerWrap>
            <Text>2.4s</Text>
          </TriggerWrap>
          <Tooltip {...args}>
            <TooltipArrow />
            Total latency of the trace
          </Tooltip>
        </TooltipTrigger>
      </Case>
    </Stack>
  ),
};

/**
 * `RichTooltip` compositions. Title and description are each optional; an
 * action sits below them in `RichTooltipActions`. When the parts do not fit,
 * any content can be passed as children directly — production uses this for
 * token and cost breakdowns (see `Domains/Cost`).
 *
 * Production actions are links, as here. Do not put a `Button` in a rich
 * tooltip: it is rendered inside `TooltipTrigger`, so it also takes the
 * trigger's focusable props and ref, and the tooltip is then positioned
 * against its own button instead of the trigger.
 */
export const RichTooltipContent: Story = {
  name: "Rich Tooltip",
  render: () => {
    const placement: RichTooltipProps["placement"] = "right";
    return (
      <Stack>
        <Case label="Title and description" height={130}>
          <TooltipTrigger isOpen>
            <Button size="S">Rich tooltip</Button>
            <RichTooltip placement={placement}>
              <TooltipArrow />
              <RichTooltipTitle>Rich tooltip</RichTooltipTitle>
              <RichTooltipDescription>
                Rich tooltips bring attention to a particular element or feature
                that warrants the user&apos;s focus.
              </RichTooltipDescription>
            </RichTooltip>
          </TooltipTrigger>
        </Case>
        <Case label="Title only" height={80}>
          <TooltipTrigger isOpen>
            <Button size="S">Title only</Button>
            <RichTooltip placement={placement}>
              <TooltipArrow />
              <RichTooltipTitle>Important Feature</RichTooltipTitle>
            </RichTooltip>
          </TooltipTrigger>
        </Case>
        <Case label="Description only" height={120}>
          <TooltipTrigger isOpen>
            <Button size="S">Description only</Button>
            <RichTooltip placement={placement}>
              <TooltipArrow />
              <RichTooltipDescription>
                This is a detailed explanation of the feature or functionality
                that provides comprehensive context to help users understand
                what this element does.
              </RichTooltipDescription>
            </RichTooltip>
          </TooltipTrigger>
        </Case>
        <Case label="With an action" height={150}>
          <TooltipTrigger isOpen>
            <TriggerWrap>
              <Icon
                svg={<Icons.CloseCircle />}
                color="danger"
                aria-label="error"
              />
            </TriggerWrap>
            <RichTooltip placement={placement}>
              <TooltipArrow />
              <RichTooltipTitle>Experiment Error</RichTooltipTitle>
              <RichTooltipDescription>
                This experiment encountered an error during execution.
              </RichTooltipDescription>
              <RichTooltipActions>
                <Link to="/datasets/1/experiments/1">View details</Link>
              </RichTooltipActions>
            </RichTooltip>
          </TooltipTrigger>
        </Case>
        <Case label="Custom children" height={110}>
          <TooltipTrigger isOpen>
            <Button size="S">Custom content</Button>
            <RichTooltip placement={placement}>
              <TooltipArrow />
              <div>
                <strong>Custom Content</strong>
                <br />
                You can provide any custom content as children when you need
                more control over the tooltip structure.
              </div>
            </RichTooltip>
          </TooltipTrigger>
        </Case>
      </Stack>
    );
  },
};

/**
 * How each surface copes with content length. `Tooltip` wraps at its 200px
 * maximum width. `RichTooltip` grows to 300px and then wraps; an explicit
 * `width` replaces that maximum with a fixed width.
 */
export const ContentLength: Story = {
  render: () => (
    <Stack>
      <Case label="Tooltip — empty string">
        <TooltipTrigger isOpen>
          <Button size="S">Empty</Button>
          <Tooltip placement="right">{""}</Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Tooltip — one character">
        <TooltipTrigger isOpen>
          <Button size="S">One character</Button>
          <Tooltip placement="right">K</Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Tooltip — regular">
        <TooltipTrigger isOpen>
          <Button size="S">Regular</Button>
          <Tooltip placement="right">Copy to clipboard</Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Tooltip — long" height={170}>
        <TooltipTrigger isOpen>
          <Button size="S">Long</Button>
          <Tooltip placement="right">
            This is a longer tooltip that demonstrates how the component handles
            multiple lines of text. The tooltip will wrap content appropriately
            within its maximum width constraints.
          </Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Rich tooltip — long" height={250}>
        <TooltipTrigger isOpen>
          <Button size="S">Long content</Button>
          <RichTooltip placement="right">
            <TooltipArrow />
            <RichTooltipTitle>Comprehensive Feature Guide</RichTooltipTitle>
            <RichTooltipDescription>
              This is a comprehensive explanation of a complex feature that
              requires multiple sentences to fully describe. The tooltip will
              automatically wrap the content to maintain readability while
              staying within the maximum width constraints. This helps users
              understand complex functionality without overwhelming the
              interface.
            </RichTooltipDescription>
          </RichTooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Rich tooltip — fixed width (400px)" height={130}>
        <TooltipTrigger isOpen>
          <Button size="S">Fixed width</Button>
          <RichTooltip placement="right" width={400}>
            <TooltipArrow />
            <RichTooltipTitle>Fixed width</RichTooltipTitle>
            <RichTooltipDescription>
              An explicit width replaces the 300px maximum, so this description
              runs wider before it wraps.
            </RichTooltipDescription>
          </RichTooltip>
        </TooltipTrigger>
      </Case>
    </Stack>
  ),
};

const placementGridCSS = (padding: CSSProperties["padding"]) =>
  ({
    display: "grid",
    gridTemplateColumns: "repeat(3, 120px)",
    rowGap: 80,
    columnGap: 40,
    padding,
    justifyItems: "center",
  }) satisfies CSSProperties;

const sides = [
  { placement: "top", column: 2, row: 1, where: "above" },
  { placement: "left", column: 1, row: 2, where: "to the left of" },
  { placement: "right", column: 3, row: 2, where: "to the right of" },
  { placement: "bottom", column: 2, row: 3, where: "below" },
] as const;

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Both surfaces on each side of their trigger. The arrow rotates to point at
 * the trigger on every side. React Aria flips a tooltip to the opposite side
 * when there is not enough room, so the requested placement is a preference.
 */
export const Placements: Story = {
  render: () => (
    <Flex direction="column" gap="size-200">
      <Text size="S" color="text-700">
        Tooltip
      </Text>
      <div style={placementGridCSS("60px 160px")}>
        {sides.map(({ placement, column, row }) => (
          <div key={placement} style={{ gridColumn: column, gridRow: row }}>
            <TooltipTrigger isOpen>
              <Button size="S">{capitalize(placement)}</Button>
              <Tooltip placement={placement}>
                <TooltipArrow />
                {capitalize(placement)} placement
              </Tooltip>
            </TooltipTrigger>
          </div>
        ))}
      </div>
      <Text size="S" color="text-700">
        Rich tooltip
      </Text>
      <div style={placementGridCSS("110px 240px")}>
        {sides.map(({ placement, column, row, where }) => (
          <div key={placement} style={{ gridColumn: column, gridRow: row }}>
            <TooltipTrigger isOpen>
              <Button size="S">{capitalize(placement)}</Button>
              <RichTooltip placement={placement}>
                <TooltipArrow />
                <RichTooltipTitle>
                  {capitalize(placement)} placement
                </RichTooltipTitle>
                <RichTooltipDescription>
                  Appears {where} the trigger
                </RichTooltipDescription>
              </RichTooltip>
            </TooltipTrigger>
          </div>
        ))}
      </div>
    </Flex>
  ),
};

/**
 * The launch and dismissal behavior, with uncontrolled triggers: hover or
 * focus a trigger to open its tooltip, and leave, blur, or press Escape to
 * close it. `TooltipTrigger` waits 1500ms by default; much of Phoenix passes
 * a shorter `delay`, often `0`. Once one tooltip has opened, adjacent
 * triggers open theirs immediately until the pointer rests. `isDisabled`
 * suppresses the tooltip while leaving the trigger usable.
 */
export const Interaction: Story = {
  render: () => (
    <Stack>
      <Case label="Default delay (1500ms)">
        <TooltipTrigger>
          <Button size="S">Hover me</Button>
          <Tooltip placement="right">
            <TooltipArrow />
            Opened after the default delay
          </Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="delay={0}">
        <TooltipTrigger delay={0}>
          <Button size="S">Hover me</Button>
          <Tooltip placement="right">
            <TooltipArrow />
            Opened immediately
          </Tooltip>
        </TooltipTrigger>
      </Case>
      <Case label="Adjacent triggers (warm-up)">
        <Flex direction="row" gap="size-100">
          {["First", "Second", "Third"].map((label) => (
            <TooltipTrigger key={label}>
              <Button size="S">{label}</Button>
              <Tooltip placement="top">{label} tooltip</Tooltip>
            </TooltipTrigger>
          ))}
        </Flex>
      </Case>
      <Case label="Rich tooltip">
        <TooltipTrigger delay={0}>
          <Button size="S">Hover me</Button>
          <RichTooltip placement="right">
            <TooltipArrow />
            <RichTooltipTitle>Rich tooltip</RichTooltipTitle>
            <RichTooltipDescription>
              Stays open while the pointer moves onto it; a plain tooltip does
              not.
            </RichTooltipDescription>
          </RichTooltip>
        </TooltipTrigger>
      </Case>
      <Case label="isDisabled">
        <TooltipTrigger isDisabled>
          <Button size="S">Hover me</Button>
          <Tooltip placement="right">Never shown</Tooltip>
        </TooltipTrigger>
      </Case>
    </Stack>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: (args: TooltipProps) => (
    <TooltipTrigger defaultOpen>
      <Button>Hover me</Button>
      <Tooltip {...args}>
        <TooltipArrow />
        Helpful context
      </Tooltip>
    </TooltipTrigger>
  ),
  args: {
    placement: "top",
  },
};
