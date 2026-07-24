import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Counter,
  Icon,
  Icons,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
} from "@phoenix/components";

export type SessionView = "turns" | "traces" | "annotations";

const SESSION_VIEWS: SessionView[] = ["turns", "traces", "annotations"];

export function isSessionView(value: unknown): value is SessionView {
  return SESSION_VIEWS.some((view) => view === value);
}

const tabLabelCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

/**
 * The top-level tabs for a session. The tab panels render the content for the
 * selected view only, so the caller passes the content for the current view.
 */
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
        if (isSessionView(key)) {
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
        <Tab id="annotations">
          <span css={tabLabelCSS}>
            <Icon svg={<Icons.Edit2 />} />
            Annotations
          </span>
        </Tab>
      </TabList>
      {SESSION_VIEWS.map((view) => (
        <LazyTabPanel key={view} id={view}>
          {children}
        </LazyTabPanel>
      ))}
    </Tabs>
  );
}
