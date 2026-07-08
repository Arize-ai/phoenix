import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Counter,
  Icon,
  Icons,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";

export type SessionView = "turns" | "traces";

const tabLabelCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

export function SessionViewTabs({
  sessionView,
  onSessionViewChange,
  traceCount,
  children,
}: {
  sessionView: SessionView;
  onSessionViewChange: (view: SessionView) => void;
  traceCount: number;
  children: ReactNode;
}) {
  return (
    <Tabs
      selectedKey={sessionView}
      onSelectionChange={(key) => {
        if (key === "turns" || key === "traces") {
          onSessionViewChange(key);
        }
      }}
    >
      <TabList aria-label="Session view">
        <Tab id="turns">
          <span css={tabLabelCSS}>
            <Icon svg={<Icons.MessagesSquare />} />
            Turns
            <Counter variant="quiet">{traceCount}</Counter>
          </span>
        </Tab>
        <Tab id="traces">
          <span css={tabLabelCSS}>
            <Icon svg={<Icons.Trace />} />
            Traces
            <Counter variant="quiet">{traceCount}</Counter>
          </span>
        </Tab>
      </TabList>
      <TabPanel id="turns">
        {sessionView === "turns" ? children : null}
      </TabPanel>
      <TabPanel id="traces">
        {sessionView === "traces" ? children : null}
      </TabPanel>
    </Tabs>
  );
}
