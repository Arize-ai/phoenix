import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import {
  Counter,
  Icon,
  IconButton,
  Icons,
  LazyTabPanel,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A set of panels shown one at a time, chosen from a bar of tabs. The bar is
 * horizontal by default, with an underline under the selected tab, or
 * vertical, with a filled pill behind it. `LazyTabPanel` is a `TabPanel` that
 * renders its content only while its tab is selected.
 *
 * Hover and keyboard focus are drawn only while the pointer or focus is on a
 * tab, so they are not shown here.
 */
const meta: Meta = {
  title: "Design System/Navigation/Tabs",
  component: Tabs,
  subcomponents: { TabList, Tab, TabPanel, LazyTabPanel },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=527-1453",
    },
  },
};

export default meta;

type SpanTab = { id: string; name: string; count?: number };

const SPAN_TABS: SpanTab[] = [
  { id: "info", name: "Info" },
  { id: "attributes", name: "Attributes" },
  { id: "events", name: "Events", count: 3 },
];

const PROJECT_TABS = ["Spans", "Traces", "Sessions", "Metrics", "Config"];

const TAB_STATES: {
  label: string;
  selectedKey: string;
  disabledKeys: string[];
}[] = [
  { label: "Unselected", selectedKey: "info", disabledKeys: [] },
  { label: "Selected", selectedKey: "attributes", disabledKeys: [] },
  { label: "Disabled", selectedKey: "info", disabledKeys: ["attributes"] },
];

const ORIENTATIONS: {
  label: "horizontal" | "vertical";
  code: true;
}[] = [
  { label: "horizontal", code: true },
  { label: "vertical", code: true },
];

const PADDING: { label: string; code: true; padded: boolean }[] = [
  { label: "false", code: true, padded: false },
  { label: "true", code: true, padded: true },
];

const TAB_COUNTS: { label: string; names: string[] }[] = [
  { label: "1 tab", names: PROJECT_TABS.slice(0, 1) },
  { label: "3 tabs", names: PROJECT_TABS.slice(0, 3) },
  {
    label: "12 tabs",
    names: [
      ...PROJECT_TABS,
      "Annotations",
      "Evaluators",
      "Datasets",
      "Experiments",
      "Prompts",
      "Playground",
      "Settings",
    ],
  },
];

function SpanTabList({ extra }: { extra?: ReactNode }) {
  return (
    <TabList aria-label="Span details" extra={extra}>
      {SPAN_TABS.map((tab) => (
        <Tab key={tab.id} id={tab.id}>
          {tab.name}
          {tab.count != null ? (
            <>
              {" "}
              <Counter>{tab.count}</Counter>
            </>
          ) : null}
        </Tab>
      ))}
    </TabList>
  );
}

function StateTabs({
  orientation,
  selectedKey,
  disabledKeys,
}: {
  orientation: "horizontal" | "vertical";
  selectedKey: string;
  disabledKeys: string[];
}) {
  return (
    <Tabs
      orientation={orientation}
      selectedKey={selectedKey}
      disabledKeys={disabledKeys}
    >
      <SpanTabList />
    </Tabs>
  );
}

export const Default: StoryFn = () => (
  <View width="480px" height="160px">
    <Tabs>
      <SpanTabList />
      {SPAN_TABS.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} padded>
          <Text>{tab.name} for the selected span</Text>
        </TabPanel>
      ))}
    </Tabs>
  </View>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "column" };

/**
 * The state is that of the Attributes tab.
 */
export const OrientationsAndStates: StoryFn = () => (
  <OptionGrid
    rows={ORIENTATIONS}
    columns={TAB_STATES}
    alignRows="start"
    renderCell={(orientation, state) => (
      <StateTabs
        orientation={orientation.label}
        selectedKey={state?.selectedKey ?? "info"}
        disabledKeys={state?.disabledKeys ?? []}
      />
    )}
  />
);
OrientationsAndStates.tags = ["!dev"];
OrientationsAndStates.parameters = { themeLayout: "column" };

export const PanelPadding: StoryFn = () => (
  <OptionGrid
    rows={ORIENTATIONS}
    columns={PADDING}
    alignRows="start"
    renderCell={(orientation, padding) => (
      <View
        width="320px"
        height="120px"
        borderColor="default"
        borderWidth="thin"
      >
        <Tabs orientation={orientation.label}>
          <TabList aria-label="Span details">
            <Tab id="info">Info</Tab>
            <Tab id="attributes">Attributes</Tab>
          </TabList>
          <TabPanel id="info" padded={padding?.padded}>
            <Text>Info for the selected span</Text>
          </TabPanel>
          <TabPanel id="attributes" padded={padding?.padded}>
            <Text>Attributes for the selected span</Text>
          </TabPanel>
        </Tabs>
      </View>
    )}
  />
);
PanelPadding.tags = ["!dev"];
PanelPadding.parameters = { themeLayout: "column" };

export const TabCount: StoryFn = () => (
  <OptionGrid
    rows={TAB_COUNTS}
    renderCell={(count) => (
      <View width="480px">
        <Tabs>
          <TabList aria-label="Project">
            {count.names.map((name) => (
              <Tab key={name} id={name}>
                {name}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </View>
    )}
  />
);
TabCount.tags = ["!dev"];
TabCount.parameters = { themeLayout: "column" };

export const Extra: StoryFn = () => (
  <View width="480px">
    <Tabs>
      <SpanTabList
        extra={
          <IconButton size="S" aria-label="Collapse all sections">
            <Icon svg={<Icons.RowCollapse />} />
          </IconButton>
        }
      />
    </Tabs>
  </View>
);
Extra.tags = ["!dev"];
Extra.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <View width="100%">
      <Tabs>
        <SpanTabList />
        {SPAN_TABS.map((tab) => (
          <TabPanel key={tab.id} id={tab.id} padded>
            <Text>{tab.name} for the selected span</Text>
          </TabPanel>
        ))}
      </Tabs>
    </View>
  ),
};
