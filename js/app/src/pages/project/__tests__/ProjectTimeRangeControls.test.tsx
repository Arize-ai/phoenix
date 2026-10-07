import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimeRangeControlsProps } from "@phoenix/components/datetime";

import type { ProjectTimeRangeControls_data$key } from "../__generated__/ProjectTimeRangeControls_data.graphql";
import { ProjectTimeRangeControls } from "../ProjectTimeRangeControls";

const relayMocks = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  useRefetchableFragment: () => [
    { streamingLastUpdatedAt: null },
    relayMocks.refetch,
  ],
}));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({
    isStreaming: true,
    setIsStreaming: vi.fn(),
    setFetchKey: vi.fn(),
  }),
}));

vi.mock("@phoenix/components/datetime", () => ({
  useTimeRange: () => ({ refreshLiveTimeRange: vi.fn() }),
  ConnectedTimeRangeControls: (
    props: Omit<TimeRangeControlsProps, "value" | "onChange">
  ) => (
    <output
      data-is-live={String(props.isLive)}
      data-has-toggle={String(props.onIsLiveChange != null)}
      data-is-toggle-disabled={String(props.isLiveToggleDisabled)}
    />
  ),
}));

const REFRESH_INTERVAL_MS = 2000;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  relayMocks.refetch.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

/**
 * Mirrors the project route tree: the controls render in the project layout,
 * above the outlet holding the trace and session drawer routes.
 */
function renderProjectRoute(path: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <ProjectTimeRangeControls
                  project={{} as ProjectTimeRangeControls_data$key}
                />
                <Outlet />
              </>
            }
          >
            <Route path="traces" element={null}>
              <Route path="compare" element={null} />
              <Route path=":traceId" element={null} />
            </Route>
            <Route path="spans" element={null}>
              <Route path="compare" element={null} />
              <Route path=":traceId" element={null} />
            </Route>
            <Route path="sessions" element={null}>
              <Route path=":sessionId" element={null} />
            </Route>
            <Route path="config" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  });
}

function getControls() {
  const output = container.querySelector("output");
  if (!output) {
    throw new Error("controls not rendered");
  }
  return output.dataset;
}

describe("ProjectTimeRangeControls", () => {
  it.each(["/projects/p/traces", "/projects/p/traces/", "/projects/p/spans"])(
    "streams on %s",
    (path) => {
      renderProjectRoute(path);
      act(() => {
        vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
      });

      expect(relayMocks.refetch).toHaveBeenCalledTimes(1);
      expect(getControls()).toMatchObject({
        isLive: "true",
        hasToggle: "true",
        isToggleDisabled: "false",
      });
    }
  );

  it.each([
    "/projects/p/traces/t1",
    "/projects/p/spans/t1",
    "/projects/p/sessions/s1",
    "/projects/p/traces/compare?traceId=t1&traceId=t2",
    "/projects/p/spans/compare?traceId=t1&traceId=t2&selectedSpanNodeId=s1",
  ])("pauses streaming and disables the toggle while %s is open", (path) => {
    renderProjectRoute(path);
    act(() => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2);
    });

    expect(relayMocks.refetch).not.toHaveBeenCalled();
    expect(getControls()).toMatchObject({
      isLive: "false",
      hasToggle: "true",
      isToggleDisabled: "true",
    });
  });

  it("hides the toggle and does not stream off the streamable tabs", () => {
    renderProjectRoute("/projects/p/config");
    act(() => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2);
    });

    expect(relayMocks.refetch).not.toHaveBeenCalled();
    expect(getControls()).toMatchObject({
      isLive: "false",
      hasToggle: "false",
    });
  });
});
