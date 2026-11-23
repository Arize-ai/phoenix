import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import {
  Button,
  Icon,
  IconButton,
  Icons,
  Text,
  Toolbar,
} from "@phoenix/components";
import { Group } from "@phoenix/components/core/layout/Group";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A row of related controls announced together as one `group`. It lays its
 * children out with a small gap and passes `size` to every control inside
 * that does not set its own. Give it an `aria-label` naming what the controls
 * act on.
 *
 * Inside a `Toolbar` the group lays out no box of its own, so its controls
 * join the toolbar's row while keeping the group's name.
 *
 * `isDisabled`, `isInvalid` and `isReadOnly` are accepted but have no styling,
 * and they do not disable the controls inside.
 */
const meta: Meta = {
  title: "Design System/Layout/Group",
  tags: ["updated", "unreviewed", "complete"],
  component: Group,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type GroupProps = ComponentProps<typeof Group>;

const SelectionActions = (props: Partial<GroupProps>) => (
  <Group aria-label="Span selection actions" {...props}>
    <Button variant="primary">Add to Dataset</Button>
    <Button>Transfer</Button>
    <Button
      aria-label="Delete Traces"
      variant="danger"
      leadingVisual={<Icon svg={<Icons.Trash />} />}
    />
  </Group>
);

export const Default: StoryFn = () => <SelectionActions />;
Default.tags = ["!dev"];

export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={(["S", "M", "L"] as const).map((size) => ({
      label: size,
      code: true,
      size,
    }))}
    renderCell={(row) => <SelectionActions size={row.size} />}
  />
);
Sizes.tags = ["!dev"];

const STATES: { label: string; props: Partial<GroupProps> }[] = [
  { label: "Default", props: {} },
  { label: "Read only", props: { isReadOnly: true } },
  { label: "Disabled", props: { isDisabled: true } },
  { label: "Invalid", props: { isInvalid: true } },
];

export const States: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    renderCell={(row) => <SelectionActions {...row.props} />}
  />
);
States.tags = ["!dev"];

export const InAToolbar: StoryFn = () => (
  <Toolbar aria-label="Span selection">
    <Group aria-label="Span selection">
      <IconButton aria-label="Clear selection">
        <Icon svg={<Icons.Close />} />
      </IconButton>
      <Text>3 spans selected</Text>
    </Group>
    <SelectionActions size="M" />
  </Toolbar>
);
InAToolbar.storyName = "In a Toolbar";
InAToolbar.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Group aria-label="Alignment">
      <Button>Left</Button>
      <Button>Middle</Button>
      <Button>Right</Button>
    </Group>
  ),
};
