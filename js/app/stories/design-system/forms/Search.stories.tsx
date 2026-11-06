import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { SearchFieldProps } from "@phoenix/components";
import {
  DebouncedSearch,
  FieldError,
  Input,
  Label,
  SearchField,
  Text,
  View,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * Search input. `SearchField` is the field: search icon, input, and clear
 * button. `DebouncedSearch` is the same field with its icon and input built
 * in and its `onChange` debounced; most page filter bars use it. For a
 * toolbar too tight for an idle field, use `Search Button`.
 */
const meta: Meta = {
  title: "Design System/Forms/Search",
  tags: ["updated", "unreviewed", "incomplete"],
  component: SearchField,
  subcomponents: { DebouncedSearch },
  parameters: {
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=152-486",
    },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <View width="320px">
    <SearchField aria-label="Search projects by name">
      <SearchIcon />
      <Input placeholder="Search projects by name" />
    </SearchField>
  </View>
);
Default.tags = ["!dev"];

const STATES: {
  label: string;
  props: Partial<SearchFieldProps>;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "populated", props: { defaultValue: "llm-chat" } },
  { label: "required", props: { isRequired: true } },
  { label: "read only", props: { isReadOnly: true, value: "llm-chat" } },
  { label: "disabled", props: { isDisabled: true, defaultValue: "llm-chat" } },
  {
    label: "error",
    props: { isInvalid: true, defaultValue: "llm-chat(" },
    error: "Unbalanced parenthesis",
  },
];

const SLOTS: {
  label: string;
  hasLabel: boolean;
  hasIcon: boolean;
  description?: string;
}[] = [
  { label: "Icon", hasLabel: false, hasIcon: true },
  { label: "Label and icon", hasLabel: true, hasIcon: true },
  { label: "Label", hasLabel: true, hasIcon: false },
  {
    label: "Icon and description",
    hasLabel: false,
    hasIcon: true,
    description: "Matches project names",
  },
  { label: "Bare", hasLabel: false, hasIcon: false },
];

const ICON_SLOT = SLOTS[0];

function ProjectSearch({
  state = STATES[0],
  slots = ICON_SLOT,
  ...props
}: Partial<SearchFieldProps> & {
  state?: (typeof STATES)[number];
  slots?: (typeof SLOTS)[number];
}) {
  return (
    <SearchField
      aria-label={slots.hasLabel ? undefined : "Search projects"}
      {...props}
      {...state.props}
    >
      {slots.hasLabel ? <Label>Projects</Label> : null}
      {slots.hasIcon ? <SearchIcon /> : null}
      <Input placeholder="Search projects" />
      {slots.description ? (
        <Text slot="description">{slots.description}</Text>
      ) : null}
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </SearchField>
  );
}

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth="220px"
    alignRows="start"
    renderCell={(state, size) => (
      <ProjectSearch state={state} size={size?.size} />
    )}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

const VARIANTS = (["default", "quiet"] as const).map((variant) => ({
  label: variant,
  code: true,
  variant,
}));

export const StatesAndVariants: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={VARIANTS}
    cellWidth="220px"
    alignRows="start"
    renderCell={(state, variant) => (
      <ProjectSearch state={state} variant={variant?.variant} />
    )}
  />
);
StatesAndVariants.parameters = { themeLayout: "column" };
StatesAndVariants.tags = ["!dev"];

export const StatesAndSlots: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SLOTS}
    cellWidth="180px"
    alignRows="start"
    renderCell={(state, slots) => <ProjectSearch state={state} slots={slots} />}
  />
);
StatesAndSlots.storyName = "States and Slots";
StatesAndSlots.parameters = { themeLayout: "column" };
StatesAndSlots.tags = ["!dev"];

export const SlotsAndVariants: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    columns={VARIANTS}
    cellWidth="220px"
    alignRows="start"
    renderCell={(slots, variant) => (
      <ProjectSearch slots={slots} variant={variant?.variant} />
    )}
  />
);
SlotsAndVariants.parameters = { themeLayout: "column" };
SlotsAndVariants.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <SearchField>
      <Label>Search</Label>
      <SearchIcon />
      <Input placeholder="Type to search..." />
    </SearchField>
  ),
};
