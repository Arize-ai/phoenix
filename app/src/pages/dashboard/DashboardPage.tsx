import { useState } from "react";
import { Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  ToggleButton,
  View,
} from "@phoenix/components";
import { ConnectedLastNTimeRangePicker } from "@phoenix/components/datetime";

import { DashboardBarChart } from "./DashboardBarChart";
import { DashboardPanel } from "./DashboardPanel";
const ResponsiveGridLayout = WidthProvider(Responsive);

const layouts: Layouts = {
  lg: [
    { i: "a", x: 0, y: 0, w: 4, h: 2 },
    { i: "b", x: 4, y: 0, w: 4, h: 2 },
    { i: "c", x: 8, y: 0, w: 4, h: 2 },
  ],
};

const data = [
  { timestamp: "Page A", value: 2400 },
  { timestamp: "Page B", value: 1398 },
  { timestamp: "Page C", value: 9800 },
  { timestamp: "Page D", value: 3908 },
  { timestamp: "Page E", value: 4800 },
  { timestamp: "Page F", value: 3800 },
  { timestamp: "Page G", value: 4300 },
];

const gridContainerCSS = css`
  width: 100%;
  height: 100%;
  &[data-editable="true"] {
    background-color: var(--ac-global-color-grey-50);
    background-image: radial-gradient(
      var(--ac-global-color-grey-400) 1px,
      transparent 1px
    );
    background-size: 20px 20px;
  }
`;

export function DashboardPage() {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      `}
    >
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={1}>Dashboard Title</Heading>
          <Flex direction="row" gap="size-100">
            <ToggleButton
              leadingVisual={<Icon svg={<Icons.EditOutline />} />}
              isSelected={isEditing}
              onChange={(selected) => setIsEditing(selected)}
            />
            <ConnectedLastNTimeRangePicker />
          </Flex>
        </Flex>
      </View>
      <div data-editable={isEditing} css={gridContainerCSS}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          isResizable={isEditing}
          isDraggable={isEditing}
          containerPadding={[16, 16]}
          draggableHandle=".dashboard-panel-header"
        >
          <div key="a">
            <DashboardPanel title="Grid Item A">
              <DashboardBarChart data={data} scale="DAY" />
            </DashboardPanel>
          </div>
          <div key="b">
            <DashboardPanel title="Grid Item B">
              <DashboardBarChart data={data} scale="DAY" />
            </DashboardPanel>
          </div>
          <div key="c">
            <DashboardPanel title="Grid Item C">
              <DashboardBarChart data={data} scale="DAY" />
            </DashboardPanel>
          </div>
        </ResponsiveGridLayout>
      </div>
    </main>
  );
}
