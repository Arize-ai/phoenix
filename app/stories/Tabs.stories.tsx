import { Meta, StoryFn } from "@storybook/react";

import {
  Card,
  LazyTabPanel,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn = (args) => (
  <Card title="Basic Tabs">
    <View width="600px" padding="size-200">
      <Tabs {...args}>
        <TabList>
          <Tab id="tab1">Tab 1</Tab>
          <Tab id="tab2">Tab 2</Tab>
          <Tab id="tab3">Tab 3</Tab>
        </TabList>
        <TabPanel padded id="tab1">
          Content for Tab 1
        </TabPanel>
        <TabPanel padded id="tab2">
          Content for Tab 2
        </TabPanel>
        <TabPanel padded id="tab3">
          Content for Tab 3
        </TabPanel>
      </Tabs>
    </View>
  </Card>
);

export const Default = {
  render: Template,
  args: {},
};

const DisabledTemplate: StoryFn = (args) => (
  <Card title="Tabs with Disabled State">
    <View width="600px" padding="size-200">
      <Tabs {...args}>
        <TabList>
          <Tab id="tab1">Tab 1</Tab>
          <Tab id="tab2" isDisabled>
            Tab 2 (Disabled)
          </Tab>
          <Tab id="tab3">Tab 3</Tab>
        </TabList>
        <TabPanel padded id="tab1">
          Content for Tab 1
        </TabPanel>
        <TabPanel padded id="tab2">
          Content for Tab 2
        </TabPanel>
        <TabPanel padded id="tab3">
          Content for Tab 3
        </TabPanel>
      </Tabs>
    </View>
  </Card>
);

export const WithDisabledTab = {
  render: DisabledTemplate,
  args: {},
};

const LazyLoadingTemplate: StoryFn = (args) => (
  <Card title="Lazy Loading Tabs">
    <View width="600px" padding="size-200">
      <Tabs {...args}>
        <TabList>
          <Tab id="tab1">Tab 1</Tab>
          <Tab id="tab2">Tab 2</Tab>
          <Tab id="tab3">Tab 3</Tab>
        </TabList>
        <LazyTabPanel padded id="tab1">
          Content for Tab 1 (Lazy Loaded)
        </LazyTabPanel>
        <LazyTabPanel padded id="tab2">
          Content for Tab 2 (Lazy Loaded)
        </LazyTabPanel>
        <LazyTabPanel padded id="tab3">
          Content for Tab 3 (Lazy Loaded)
        </LazyTabPanel>
      </Tabs>
    </View>
  </Card>
);

export const LazyLoading = {
  render: LazyLoadingTemplate,
  args: {},
};

const ComplexContentTemplate: StoryFn = (args) => (
  <Card title="Tabs with Complex Content">
    <View width="600px" padding="size-200">
      <Tabs {...args}>
        <TabList>
          <Tab id="details">Details</Tab>
          <Tab id="settings">Settings</Tab>
          <Tab id="advanced">Advanced</Tab>
        </TabList>
        <TabPanel id="details">
          <h3>Product Details</h3>
          <p>
            This is a detailed description of the product with multiple
            paragraphs of text.
          </p>
          <p>It can contain rich content and complex layouts.</p>
        </TabPanel>
        <TabPanel id="settings">
          <h3>Settings Panel</h3>
          <ul>
            <li>Setting 1</li>
            <li>Setting 2</li>
            <li>Setting 3</li>
          </ul>
        </TabPanel>
        <TabPanel id="advanced">
          <h3>Advanced Options</h3>
          <div>
            <p>Advanced configuration options go here.</p>
            <button onClick={() => alert("Advanced action clicked!")}>
              Perform Action
            </button>
          </div>
        </TabPanel>
      </Tabs>
    </View>
  </Card>
);

export const ComplexContent = {
  render: ComplexContentTemplate,
  args: {},
};

const OrientationTemplate: StoryFn = (args) => (
  <Card title="Vertical Tabs">
    <View width="600px" padding="size-200">
      <Tabs {...args} orientation="vertical">
        <TabList>
          <Tab id="tab1">Tab 1</Tab>
          <Tab id="tab2">Tab 2</Tab>
          <Tab id="tab3">Tab 3</Tab>
        </TabList>
        <TabPanel padded id="tab1">
          Content for Tab 1
        </TabPanel>
        <TabPanel padded id="tab2">
          Content for Tab 2
        </TabPanel>
        <TabPanel padded id="tab3">
          Content for Tab 3
        </TabPanel>
      </Tabs>
    </View>
  </Card>
);

export const VerticalOrientation = {
  render: OrientationTemplate,
  args: {},
};
