import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import {
  type TimeRangeContextType,
  TimeRangeProvider,
  useTimeRange,
} from "../TimeRangeContext";
import { useTimeRangeSelectionKey } from "../useTimeRangeSelectionKey";

installTestStorage();

let container: HTMLDivElement;
let root: Root;
let selectionKey: string;
let controls: Pick<
  TimeRangeContextType,
  "refreshLiveTimeRange" | "setTimeRange" | "setCustomTimeRange"
>;

function SelectionKeyReader() {
  const { refreshLiveTimeRange, setTimeRange, setCustomTimeRange } =
    useTimeRange();
  const key = useTimeRangeSelectionKey();
  useEffect(() => {
    controls = { refreshLiveTimeRange, setTimeRange, setCustomTimeRange };
    selectionKey = key;
  });
  return null;
}

function renderReader(initialEntry: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <PreferencesProvider>
          <AgentProvider>
            <TimeRangeProvider>
              <SelectionKeyReader />
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T12:00:05.000Z"));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useTimeRangeSelectionKey", () => {
  it("keeps a live preset's key while its window slides forward", () => {
    renderReader("/projects/project-1?timeRangeKey=1h");
    const initialKey = selectionKey;

    vi.setSystemTime(new Date("2026-01-01T12:05:05.000Z"));
    act(() => controls.refreshLiveTimeRange());

    expect(selectionKey).toBe(initialKey);
  });

  it("changes when another preset or a custom range is picked", () => {
    renderReader("/projects/project-1?timeRangeKey=1h");
    const liveKey = selectionKey;

    act(() =>
      controls.setTimeRange({ timeRangeKey: "7d", start: null, end: null })
    );
    const otherPresetKey = selectionKey;
    act(() =>
      controls.setCustomTimeRange({
        start: new Date("2026-01-01T09:00:00.000Z"),
        end: new Date("2026-01-01T10:00:00.000Z"),
      })
    );

    expect(new Set([liveKey, otherPresetKey, selectionKey]).size).toBe(3);
  });
});
