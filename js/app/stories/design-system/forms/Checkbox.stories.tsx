import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { CheckboxProps } from "@phoenix/components";
import { Checkbox, Flex } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A checkbox for a yes/no choice, or `indeterminate` for a parent whose
 * children are partly selected. Without visible text it needs an
 * `aria-label`, as in table row selection.
 *
 * `isHovered` forces the hover style, for a wrapper that makes a larger hover
 * target; the grids use it to show hover. `isInvalid` is accepted but has no
 * styling yet, so its column looks like Default. It is shown anyway: the grid
 * is how a missing style gets noticed.
 */
const meta: Meta = {
  title: "Design System/Forms/Checkbox",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Checkbox,
  parameters: {
    layout: "centered",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=268-408",
    },
  },
};

export default meta;

export const Default: StoryFn = () => <Checkbox>Label</Checkbox>;
Default.tags = ["!dev"];

const SELECTIONS: { label: string; props: Partial<CheckboxProps> }[] = [
  { label: "unchecked", props: {} },
  { label: "checked", props: { defaultSelected: true } },
  { label: "indeterminate", props: { isIndeterminate: true } },
];

const STATES: { label: string; props: Partial<CheckboxProps> }[] = [
  { label: "Default", props: {} },
  { label: "Hovered", props: { isHovered: true } },
  { label: "Disabled", props: { isDisabled: true } },
  { label: "Invalid", props: { isInvalid: true } },
];

/** Every selection in every state, with or without a visible label. */
function CheckboxGrid({ withLabel }: { withLabel: boolean }) {
  return (
    <OptionGrid
      rows={SELECTIONS}
      columns={STATES}
      renderCell={(selection, state) => (
        <Checkbox
          {...selection.props}
          {...state?.props}
          aria-label={withLabel ? undefined : "Label"}
        >
          {withLabel ? "Label" : null}
        </Checkbox>
      )}
    />
  );
}

export const NoLabel: StoryFn = () => <CheckboxGrid withLabel={false} />;
NoLabel.tags = ["!dev"];

export const WithLabel: StoryFn = () => <CheckboxGrid withLabel />;
WithLabel.tags = ["!dev"];

/** The label accepts rich content, not only a string. */
export const WithChildren = {
  tags: ["!dev"],
  args: {
    children: (
      <>
        <strong>Bold text</strong> and <em>italic text</em>
      </>
    ),
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="column" gap="size-100">
      <Checkbox defaultSelected>Checked checkbox</Checkbox>
      <Checkbox>Checkbox label</Checkbox>
    </Flex>
  ),
};
