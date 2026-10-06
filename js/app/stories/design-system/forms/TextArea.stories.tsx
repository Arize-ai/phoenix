import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TextFieldProps } from "@phoenix/components";
import { FieldError, Label, TextArea, TextField } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Text Area",
  tags: ["updated", "unreviewed", "incomplete"],
  component: TextArea,
  subcomponents: { TextField },
};

export default meta;

export const Default: StoryFn = () => (
  <TextField>
    <Label>Description</Label>
    <TextArea placeholder="e.g. a test split" />
  </TextField>
);
Default.tags = ["!dev"];

const DESCRIPTION = "A golden dataset for structured data extraction";

const STATES: {
  label: string;
  props: Partial<TextFieldProps>;
  placeholder?: string;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "placeholder", props: {}, placeholder: "A short description" },
  { label: "populated", props: { defaultValue: DESCRIPTION } },
  { label: "required", props: { isRequired: true } },
  { label: "read only", props: { isReadOnly: true, value: DESCRIPTION } },
  { label: "disabled", props: { isDisabled: true, defaultValue: DESCRIPTION } },
  {
    label: "error",
    props: { isInvalid: true, defaultValue: DESCRIPTION },
    error: "Description must be 40 characters or fewer",
  },
];

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
      <TextField size={size?.size} {...state.props}>
        <Label>Description</Label>
        <TextArea placeholder={state.placeholder} />
        {state.error ? <FieldError>{state.error}</FieldError> : null}
      </TextField>
    )}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <TextField defaultValue={DESCRIPTION}>
      <Label>Description</Label>
      <TextArea />
    </TextField>
  ),
};
