import { Panel, PanelGroup } from "react-resizable-panels";
import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import { Text, Token, View } from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";

const meta: Meta = {
  title: "TitledPanel",
  component: TitledPanel,
  parameters: {
    layout: "centered",
  },
};

const bodyStyle = { width: "600px", height: "300px" };

export default meta;

const Template: StoryFn = (args) => (
  <Card title="TitledPanel" bodyStyle={bodyStyle} variant="compact">
    <PanelGroup direction="vertical">
      <TitledPanel title="Regular Panel">
        <View padding="size-200">
          <Text>This is a non-resizable panel with title</Text>
        </View>
      </TitledPanel>
      <TitledPanel title="Basic Panel" resizable {...args}>
        <View padding="size-200">
          <Text>This is a basic panel with a title</Text>
        </View>
      </TitledPanel>
    </PanelGroup>
  </Card>
);

export const Default: Meta<typeof TitledPanel> = {
  render: Template,
  args: {},
};

const WithCustomContentTemplate: StoryFn = (args) => (
  <Card
    title="TitledPanel with Custom Content"
    bodyStyle={bodyStyle}
    variant="compact"
  >
    <PanelGroup direction="vertical">
      <Panel>
        <View padding="size-200">
          <Text>This is a regular panel with some content</Text>
        </View>
      </Panel>
      <TitledPanel title="Custom Content Panel" resizable {...args}>
        <View padding="size-200">
          <h3>Custom Content</h3>
          <p>
            This panel contains custom content with different styling and
            layout.
          </p>
        </View>
      </TitledPanel>
    </PanelGroup>
  </Card>
);

export const WithCustomContent: Meta<typeof TitledPanel> = {
  render: WithCustomContentTemplate,
  args: {},
};

const MultiplePanelsTemplate: StoryFn = (args) => (
  <Card title="Multiple TitledPanels" bodyStyle={bodyStyle} variant="compact">
    <PanelGroup direction="vertical">
      <TitledPanel title="Regular Panel">
        <View padding="size-200">
          <Text>This is the main content panel</Text>
        </View>
      </TitledPanel>
      <TitledPanel resizable title="First Titled Panel" {...args}>
        <View padding="size-200">
          <Text>This is the first titled panel</Text>
        </View>
      </TitledPanel>
      <TitledPanel resizable title="Second Titled Panel" {...args}>
        <View padding="size-200">
          <Text>This is the second titled panel</Text>
        </View>
      </TitledPanel>
      <TitledPanel resizable title="Third Titled Panel" {...args}>
        <View padding="size-200">
          <Text>This is the third titled panel</Text>
        </View>
      </TitledPanel>
    </PanelGroup>
  </Card>
);

export const MultiplePanels: Meta<typeof TitledPanel> = {
  render: MultiplePanelsTemplate,
  args: {},
};

const WithCustomTitleTemplate: StoryFn = (args) => (
  <Card
    title="TitledPanel with Custom Title"
    bodyStyle={bodyStyle}
    variant="compact"
  >
    <PanelGroup direction="vertical">
      <Panel>
        <View padding="size-200">
          <Text>This is the main content area</Text>
        </View>
      </Panel>
      <TitledPanel
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ac-global-dimension-size-100)",
            }}
          >
            <span>Custom Title</span>
            <Token color="green">New</Token>
          </div>
        }
        {...args}
      >
        <div style={{ padding: "var(--ac-global-dimension-size-200)" }}>
          This panel has a custom title with additional elements
        </div>
      </TitledPanel>
    </PanelGroup>
  </Card>
);

export const WithCustomTitle: Meta<typeof TitledPanel> = {
  render: WithCustomTitleTemplate,
  args: {},
};
