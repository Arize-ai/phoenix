import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { SwitchProps } from "@phoenix/components";
import { Flex, Switch } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * An on/off setting. Without visible text it needs an `aria-label`.
 *
 * `isReadOnly` is accepted but has no styling, so a read-only switch looks
 * like an enabled one while ignoring presses.
 */
const meta: Meta = {
  title: "Design System/Forms/Switch",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Switch,
  parameters: {
    layout: "centered",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=467-75",
    },
  },
};

export default meta;

export const Default: StoryFn = () => <Switch>Label</Switch>;
Default.tags = ["!dev"];

const STATES: { label: string; props: Partial<SwitchProps> }[] = [
  { label: "Off", props: {} },
  { label: "On", props: { defaultSelected: true } },
  { label: "Off, disabled", props: { isDisabled: true } },
  { label: "On, disabled", props: { defaultSelected: true, isDisabled: true } },
  { label: "Off, read only", props: { isReadOnly: true } },
  {
    label: "On, read only",
    props: { defaultSelected: true, isReadOnly: true },
  },
];

const SIZES: { label: SwitchProps["size"] & string; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

function SwitchGrid({ withLabel }: { withLabel: boolean }) {
  return (
    <OptionGrid
      rows={STATES}
      columns={SIZES}
      renderCell={(state, size) => (
        <Switch
          {...state.props}
          size={size?.label}
          aria-label={withLabel ? undefined : "Label"}
        >
          {withLabel ? "Label" : null}
        </Switch>
      )}
    />
  );
}

export const NoLabel: StoryFn = () => <SwitchGrid withLabel={false} />;
NoLabel.tags = ["!dev"];
NoLabel.parameters = { themeLayout: "column" };

export const WithLabel: StoryFn = () => <SwitchGrid withLabel />;
WithLabel.tags = ["!dev"];
WithLabel.parameters = { themeLayout: "column" };

export const LabelPlacement: StoryFn = () => (
  <OptionGrid
    rows={[
      { label: "end", code: true },
      { label: "start", code: true },
    ]}
    columns={SIZES}
    renderCell={(placement, size) => (
      <Switch
        labelPlacement={placement.label as SwitchProps["labelPlacement"]}
        size={size?.label}
      >
        Label
      </Switch>
    )}
  />
);
LabelPlacement.tags = ["!dev"];
LabelPlacement.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="column" gap="size-100">
      <Switch defaultSelected>Enable notifications</Switch>
      <Switch>Email digest</Switch>
    </Flex>
  ),
};
