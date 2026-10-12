import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import { Label, Radio, RadioGroup, Text } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

type RadioGroupProps = ComponentProps<typeof RadioGroup>;

/**
 * One option in a single choice among a few that are all worth showing at
 * once. For an icon-only choice, or one that reads as a mode switch, use
 * `SegmentedControl` instead.
 *
 * A `Radio` renders only inside a `RadioGroup`. The group owns the selection
 * and the read only, invalid and required states; a single option can also be
 * disabled on its own. Without visible text a radio needs an `aria-label`,
 * though no Phoenix radio is used that way. `isInvalid` is accepted but has no
 * styling yet, so its column looks like Default.
 */
const meta: Meta = {
  title: "Design System/Forms/Radio",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Radio,
  subcomponents: { RadioGroup },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <RadioGroup aria-label="Label" defaultValue="label">
    <Radio value="label">Label</Radio>
  </RadioGroup>
);
Default.tags = ["!dev"];

const SELECTIONS: { label: string; props: Partial<RadioGroupProps> }[] = [
  { label: "unselected", props: {} },
  { label: "selected", props: { defaultValue: "label" } },
];

const STATES: {
  label: string;
  groupProps?: Partial<RadioGroupProps>;
  isDisabled?: boolean;
}[] = [
  { label: "Default" },
  { label: "Read only", groupProps: { isReadOnly: true } },
  { label: "Disabled", isDisabled: true },
  { label: "Invalid", groupProps: { isInvalid: true } },
];

function RadioGrid({ withLabel }: { withLabel: boolean }) {
  return (
    <OptionGrid
      rows={SELECTIONS}
      columns={STATES}
      renderCell={(selection, state) => (
        <RadioGroup
          aria-label="Label"
          {...selection.props}
          {...state?.groupProps}
        >
          <Radio
            value="label"
            isDisabled={state?.isDisabled}
            aria-label={withLabel ? undefined : "Label"}
          >
            {withLabel ? "Label" : null}
          </Radio>
        </RadioGroup>
      )}
    />
  );
}

export const NoLabel: StoryFn = () => <RadioGrid withLabel={false} />;
NoLabel.tags = ["!dev"];

export const WithLabel: StoryFn = () => <RadioGrid withLabel />;
WithLabel.tags = ["!dev"];

const OPTIMIZATION_DIRECTIONS = [
  { value: "MAXIMIZE", label: "Maximize" },
  { value: "MINIMIZE", label: "Minimize" },
  { value: "NONE", label: "None" },
];

const GROUP_SIZES: {
  label: string;
  code?: true;
  props: Partial<RadioGroupProps>;
}[] = [
  { label: "S", code: true, props: { size: "S" } },
  { label: "M", code: true, props: { size: "M" } },
  { label: "L", code: true, props: { size: "L" } },
];

function OptimizationDirectionGroup(props: Partial<RadioGroupProps>) {
  return (
    <RadioGroup defaultValue="MAXIMIZE" {...props}>
      <Label>Optimization Direction</Label>
      {OPTIMIZATION_DIRECTIONS.map(({ value, label }) => (
        <Radio key={value} value={value}>
          {label}
        </Radio>
      ))}
    </RadioGroup>
  );
}

const GROUP_STATES: { label: string; props: Partial<RadioGroupProps> }[] = [
  { label: "", props: {} },
  { label: "isRequired", props: { isRequired: true } },
  { label: "isDisabled", props: { isDisabled: true } },
];

export const HorizontalGroup: StoryFn = () => (
  <OptionGrid
    rows={GROUP_SIZES.flatMap((size) =>
      GROUP_STATES.map((state) => ({
        label: state.label ? `${size.label} · ${state.label}` : size.label,
        code: true,
        props: { ...size.props, ...state.props },
      }))
    )}
    renderCell={(option) => <OptimizationDirectionGroup {...option.props} />}
  />
);
HorizontalGroup.tags = ["!dev"];
HorizontalGroup.parameters = { themeLayout: "column" };

export const VerticalGroup: StoryFn = () => (
  <OptionGrid
    rows={GROUP_SIZES}
    alignRows="start"
    renderCell={(option) => (
      <OptimizationDirectionGroup direction="column" {...option.props} />
    )}
  />
);
VerticalGroup.tags = ["!dev"];
VerticalGroup.parameters = { themeLayout: "row" };

export const GroupHelpText: StoryFn = () => (
  <RadioGroup defaultValue="CATEGORICAL">
    <Label>Annotation Type</Label>
    <Radio value="CATEGORICAL">Categorical</Radio>
    <Radio value="CONTINUOUS">Continuous</Radio>
    <Radio value="FREEFORM">Freeform</Radio>
    <Text slot="description">
      Categorical - assign a category - e.g. grade, A, B, C
      <br />
      Continuous - assign a score within a range - e.g. 0-1, 0.5
      <br />
      Freeform - assign a freeform text comment, e.g. &quot;good&quot;
    </Text>
  </RadioGroup>
);
GroupHelpText.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <RadioGroup aria-label="RadioGroup" defaultValue="1">
      <Radio value="1">Option 1</Radio>
      <Radio value="2">Option 2</Radio>
      <Radio value="3">Option 3</Radio>
    </RadioGroup>
  ),
};
