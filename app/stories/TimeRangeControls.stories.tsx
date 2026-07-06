import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import type {
  OpenTimeRangeWithKey,
  TimeRangeControlsProps,
} from "@phoenix/components";
import { TimeRangeControls, TimeRangeSelector } from "@phoenix/components";
import { PreferencesProvider } from "@phoenix/contexts";

const meta: Meta = {
  title: "DateTime/Time Range Controls",
  component: TimeRangeControls,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<
  TimeRangeControlsProps & {
    initialValue: OpenTimeRangeWithKey;
    withSelector?: boolean;
    withoutLiveToggle?: boolean;
  }
> = ({ initialValue, withSelector, withoutLiveToggle, ...args }) => {
  const [timeRange, setTimeRange] =
    useState<OpenTimeRangeWithKey>(initialValue);
  const [isLive, setIsLive] = useState(true);
  const controls = (
    <TimeRangeControls
      {...args}
      value={timeRange}
      onChange={setTimeRange}
      isLive={withoutLiveToggle ? undefined : isLive}
      onIsLiveChange={withoutLiveToggle ? undefined : setIsLive}
    />
  );
  return (
    <PreferencesProvider>
      {withSelector ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          {controls}
        </div>
      ) : (
        controls
      )}
    </PreferencesProvider>
  );
};

/**
 * The composite strip on its own: pan back, zoom out, play/stop, zoom in,
 * pan forward. The range starts live (open-ended), so panning forward is
 * unavailable until a pan or zoom steps off the live edge.
 */
export const Default = {
  render: Template,
  args: {
    initialValue: {
      timeRangeKey: "1h",
      start: new Date(Date.now() - 60 * 60 * 1000),
    },
  },
};

/**
 * A closed custom range (e.g. after zooming into a chart) can pan in both
 * directions and zooms around its center.
 */
export const ClosedRange = {
  render: Template,
  args: {
    initialValue: {
      timeRangeKey: "custom",
      start: new Date(Date.now() - 4 * 60 * 60 * 1000),
      end: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  },
};

/**
 * The intended composition: the controls sit directly to the right of the
 * time range selector, sharing its height and border treatment.
 */
export const BesideTimeRangeSelector = {
  render: Template,
  args: {
    withSelector: true,
    initialValue: {
      timeRangeKey: "7d",
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  },
};

/**
 * Without live-streaming props the play/stop toggle is omitted and the strip
 * is a pure pan/zoom control (e.g. the dashboards page).
 */
export const PanZoomOnly = {
  render: Template,
  args: {
    withoutLiveToggle: true,
    initialValue: {
      timeRangeKey: "custom",
      start: new Date(Date.now() - 4 * 60 * 60 * 1000),
      end: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  },
};

export const Disabled = {
  render: Template,
  args: {
    isDisabled: true,
    initialValue: {
      timeRangeKey: "1h",
      start: new Date(Date.now() - 60 * 60 * 1000),
    },
  },
};
