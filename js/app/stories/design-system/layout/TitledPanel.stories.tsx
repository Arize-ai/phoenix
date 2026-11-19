import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps, ReactNode } from "react";
import { Group, Panel } from "react-resizable-panels";

import { Button, Flex, Text, Token, View } from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A panel of a resizable `Group` with a title bar that collapses and expands
 * it. `resizable` adds a separator above the panel, so the first panel in a
 * group must not be resizable. Controls in `extra` sit outside the collapse
 * toggle and stay usable while the panel is collapsed.
 *
 * `disabled` turns off collapsing, `bordered={false}` drops the title bar's
 * bottom rule and the separator's line, and `headingLevel` puts the title in
 * the page's heading outline.
 */
const meta: Meta = {
  title: "Design System/Layout/Titled Panel",
  tags: ["updated", "unreviewed", "incomplete"],
  component: TitledPanel,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type TitledPanelProps = ComponentProps<typeof TitledPanel>;

const Frame = ({
  width,
  height,
  children,
}: {
  width: string;
  height: string;
  children: ReactNode;
}) => (
  <View
    width={width}
    height={height}
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
  >
    {children}
  </View>
);

const Body = ({ children }: { children: ReactNode }) => (
  <View padding="size-200">
    <Text>{children}</Text>
  </View>
);

export const Default: StoryFn = () => (
  <Frame width="480px" height="280px">
    <Group orientation="vertical">
      <TitledPanel
        title="Prompts"
        extra={<Button size="S">Compare</Button>}
        panelProps={{ minSize: "15%" }}
      >
        <Body>You are a helpful assistant.</Body>
      </TitledPanel>
      <TitledPanel resizable title="Output" panelProps={{ minSize: "15%" }}>
        <Body>The capital of France is Paris.</Body>
      </TitledPanel>
    </Group>
  </Frame>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "column" };

const OPTIONS: {
  label: string;
  code?: boolean;
  props: Omit<TitledPanelProps, "children">;
}[] = [
  { label: "Default", props: { title: "Inputs" } },
  {
    label: "extra",
    code: true,
    props: { title: "Inputs", extra: <Button size="S">Select dataset</Button> },
  },
  {
    label: "Title node",
    props: {
      title: (
        <Flex direction="row" gap="size-100" alignItems="center">
          Inputs
          <Token color="var(--global-color-seafoam-600)">3 variables</Token>
        </Flex>
      ),
    },
  },
  {
    label: "bordered={false}",
    code: true,
    props: { title: "Inputs", bordered: false },
  },
  { label: "disabled", code: true, props: { title: "Inputs", disabled: true } },
];

const COLLAPSE = [
  { label: "Expanded", defaultSize: "60%" },
  { label: "Collapsed", defaultSize: "0%" },
];

export const OptionsAndCollapse: StoryFn = () => (
  <OptionGrid
    rows={OPTIONS}
    columns={COLLAPSE}
    renderCell={(row, column) => (
      <Frame width="260px" height="140px">
        <Group orientation="vertical">
          <TitledPanel
            {...row.props}
            panelProps={{ defaultSize: column?.defaultSize }}
          >
            <Body>question, context</Body>
          </TitledPanel>
          <Panel>
            <Body>Output</Body>
          </Panel>
        </Group>
      </Frame>
    )}
  />
);
OptionsAndCollapse.storyName = "Options and Collapse";
OptionsAndCollapse.tags = ["!dev"];
OptionsAndCollapse.parameters = { themeLayout: "column" };

const STACK = ["Prompts", "Inputs", "Output", "Experiment"];

export const StackedPanels: StoryFn = () => (
  <OptionGrid
    columns={[
      { label: "Bordered", bordered: true },
      { label: "bordered={false}", code: true, bordered: false },
    ]}
    renderCell={(_, column) => (
      <Frame width="280px" height="320px">
        <Group orientation="vertical">
          {STACK.map((title, index) => (
            <TitledPanel
              key={title}
              title={title}
              resizable={index > 0}
              bordered={column?.bordered}
            >
              <Body>{title} content</Body>
            </TitledPanel>
          ))}
        </Group>
      </Frame>
    )}
  />
);
StackedPanels.storyName = "Stacked Panels";
StackedPanels.tags = ["!dev"];
StackedPanels.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <View
      width="288px"
      height="168px"
      borderWidth="thin"
      borderColor="default"
      borderRadius="medium"
    >
      <Group orientation="vertical">
        <TitledPanel title="Inputs">
          <View padding="size-100">
            <Text>Panel content</Text>
          </View>
        </TitledPanel>
        <TitledPanel title="Outputs" resizable>
          <View padding="size-100">
            <Text>Resizable panel</Text>
          </View>
        </TitledPanel>
      </Group>
    </View>
  ),
};
