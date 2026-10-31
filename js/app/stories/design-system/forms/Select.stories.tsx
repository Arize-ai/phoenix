import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import type { SelectProps } from "@phoenix/components";
import {
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A select component that provides a dropdown selection interface.
 * It supports different sizes, is fully accessible, and follows the design system's styling.
 */
const meta = {
  title: "Design System/Forms/Select",
  component: Select,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=264-278",
    },
  },
  tags: ["updated", "unreviewed", "incomplete"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROLES = [
  { id: "ADMIN", name: "Admin" },
  { id: "MEMBER", name: "Member" },
  { id: "VIEWER", name: "Viewer" },
];

const SelectContent = () => (
  <>
    <Label>Role</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {ROLES.map((role) => (
          <SelectItem key={role.id} id={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </ListBox>
    </Popover>
  </>
);

export const Default: Story = {
  tags: ["!dev"],
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

const STATES: {
  label: string;
  props: Partial<SelectProps>;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "populated", props: { defaultSelectedKey: "MEMBER" } },
  { label: "required", props: { isRequired: true } },
  {
    label: "disabled",
    props: { isDisabled: true, defaultSelectedKey: "MEMBER" },
  },
  {
    label: "error",
    props: { isInvalid: true },
    error: "Select a role",
  },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

function RoleSelect({
  state,
  description,
  ...props
}: Partial<SelectProps> & {
  state: (typeof STATES)[number];
  description?: string;
}) {
  return (
    <Select {...props} {...state.props}>
      <SelectContent />
      {description ? <Text slot="description">{description}</Text> : null}
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </Select>
  );
}

/**
 * Size `L` has no styling of its own: the trigger takes Button's unstyled
 * `L` and renders smaller than `S`.
 */
export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth="200px"
    alignRows="start"
    renderCell={(state, size) => <RoleSelect state={state} size={size?.size} />}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

const SLOTS: { label: string; description?: string }[] = [
  { label: "Bare" },
  { label: "Description", description: "Members can view and edit projects" },
];

export const StatesAndSlots: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SLOTS}
    cellWidth="200px"
    alignRows="start"
    renderCell={(state, slot) => (
      <RoleSelect state={state} description={slot?.description} />
    )}
  />
);
StatesAndSlots.storyName = "States and Slots";
StatesAndSlots.parameters = { themeLayout: "column" };
StatesAndSlots.tags = ["!dev"];

export const WithLongOptions: Story = {
  tags: ["!dev"],
  render: (args) => (
    <Select {...args}>
      <Label>Select a long option</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <ListBoxItem id="1">
            This is a very long option that might wrap to multiple lines
          </ListBoxItem>
          <ListBoxItem id="2">
            Another long option that demonstrates how the component handles text
            overflow
          </ListBoxItem>
          <ListBoxItem id="3">
            A third option that shows how the dropdown handles multiple items
          </ListBoxItem>
        </ListBox>
      </Popover>
    </Select>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  args: {
    defaultSelectedKey: "ADMIN",
  },
  // Opened by a pointer press rather than `defaultOpen`, which puts a
  // keyboard focus ring on the selected option.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
  render: (args) => (
    <div style={{ alignSelf: "flex-start" }}>
      <Select {...args}>
        <SelectContent />
      </Select>
    </div>
  ),
};
