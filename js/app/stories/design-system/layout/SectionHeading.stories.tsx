import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import {
  Button,
  SectionHeading,
  Switch,
  Text,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A full-width heading bar that labels the section below it, such as a
 * `DisclosureGroup` or one section of a form dialog. `subtitle` adds a
 * one-line description under the title and `extra` holds controls at the
 * right edge, such as a switch that turns the section on or a test button.
 *
 * `bordered={false}` drops the top rule, for a heading that sits right under
 * a dialog header or another rule.
 */
const meta: Meta = {
  title: "Design System/Layout/Section Heading",
  tags: ["updated", "unreviewed", "incomplete"],
  component: SectionHeading,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type SectionHeadingProps = ComponentProps<typeof SectionHeading>;

const WIDTH = "420px";

const Body = () => (
  <View padding="size-200">
    <Text>Suggested model names are listed in the model menu.</Text>
  </View>
);

export const Default: StoryFn = () => (
  <View width={WIDTH}>
    <SectionHeading>LLM models</SectionHeading>
    <Body />
  </View>
);
Default.tags = ["!dev"];

const SLOTS: {
  label: string;
  props: Partial<SectionHeadingProps>;
}[] = [
  { label: "Title only", props: {} },
  {
    label: "subtitle",
    props: { subtitle: "Replaces the built-in OpenAI list when set" },
  },
  {
    label: "extra",
    props: { extra: <Button size="S">Test credentials</Button> },
  },
  {
    label: "subtitle and extra",
    props: {
      subtitle: "Uses this provider's API key and headers",
      extra: (
        <Switch aria-label="Serve decision models" defaultSelected>
          On
        </Switch>
      ),
    },
  },
];

const BORDERS: { label: string; code: boolean; props: SectionHeadingProps }[] =
  [
    { label: "bordered", code: true, props: { bordered: true } },
    { label: "bordered={false}", code: true, props: { bordered: false } },
  ];

export const Slots: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    columns={BORDERS}
    cellWidth={WIDTH}
    renderCell={(slot, border) => (
      <View width="100%">
        <SectionHeading {...border?.props} {...slot.props}>
          Decision models
        </SectionHeading>
        <Body />
      </View>
    )}
  />
);
Slots.tags = ["!dev"];
Slots.parameters = { themeLayout: "column" };

export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <View width="100%">
      <SectionHeading
        subtitle="Uses this provider's API key and headers"
        extra={<Button size="S">Test</Button>}
      >
        Section
      </SectionHeading>
      <Body />
    </View>
  ),
};
