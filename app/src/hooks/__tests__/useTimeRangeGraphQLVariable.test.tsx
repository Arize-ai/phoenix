import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type TimeRangeGraphQLVariable,
  useTimeRangeGraphQLVariable,
} from "../useTimeRangeGraphQLVariable";

const START = new Date("2026-01-01T00:00:00.000Z");
const START_ISO = "2026-01-01T00:00:00.000Z";
// One minute later — mirrors a live "last-N" window sliding forward.
const START_SLID = new Date("2026-01-01T00:01:00.000Z");
const START_SLID_ISO = "2026-01-01T00:01:00.000Z";
const END = new Date("2026-01-02T00:00:00.000Z");
const END_ISO = "2026-01-02T00:00:00.000Z";

/**
 * Renders the hook and reports every derived value so a test can assert both
 * the conversion and the referential stability across re-renders.
 */
function Probe({
  timeRange,
  onValue,
}: {
  timeRange: OpenTimeRange;
  onValue: (value: TimeRangeGraphQLVariable) => void;
}) {
  const value = useTimeRangeGraphQLVariable(timeRange);
  onValue(value);
  return null;
}

describe("useTimeRangeGraphQLVariable", () => {
  let container: HTMLDivElement;
  let root: Root;
  let values: TimeRangeGraphQLVariable[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    values = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const onValue = (value: TimeRangeGraphQLVariable) => {
    values.push(value);
  };

  const render = (timeRange: OpenTimeRange) => {
    act(() => {
      root.render(<Probe timeRange={timeRange} onValue={onValue} />);
    });
  };

  const latest = () => values[values.length - 1];

  it("converts closed bounds to ISO strings", () => {
    render({ start: START, end: END });
    expect(latest()).toEqual({ start: START_ISO, end: END_ISO });
  });

  it("leaves an open-ended (live) window's end undefined", () => {
    render({ start: START, end: null });
    expect(latest()).toEqual({ start: START_ISO, end: undefined });
  });

  it("keeps a stable identity when the bounds are unchanged", () => {
    // Fresh objects with identical bounds mirror an unrelated re-render (e.g.
    // streamed data landing in the table). The derived variable must not change
    // identity, or it would trigger a redundant refetch when used as a refetch
    // dependency.
    render({ start: START, end: null });
    render({ start: new Date(START), end: null });
    expect(values).toHaveLength(2);
    expect(values[1]).toBe(values[0]);
  });

  it("produces a new variable when a live window slides forward", () => {
    // The slide is the refresh that must re-run the table refetch with any
    // applied filter still attached (see issue #14216).
    render({ start: START, end: null });
    render({ start: START_SLID, end: null });
    expect(values).toHaveLength(2);
    expect(values[1]).not.toBe(values[0]);
    expect(values[1]?.start).toBe(START_SLID_ISO);
  });
});
