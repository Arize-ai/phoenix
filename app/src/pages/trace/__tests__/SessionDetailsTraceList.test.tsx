import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  SessionTurnList,
  type SessionTurnRow,
} from "../SessionDetailsTraceList";

const rows = [
  {
    traceId: "trace-1",
    rootSpan: {
      attributes: "{}",
      cumulativeTokenCountTotal: 3,
      endTime: "2026-07-22T12:00:01.000Z",
      id: "span-node-1",
      input: null,
      latencyMs: 1000,
      name: "First turn",
      output: null,
      project: { id: "project-1" },
      spanId: "span-1",
      startTime: "2026-07-22T12:00:00.000Z",
      trace: {
        costSummary: { total: { cost: null } },
        id: "trace-node-1",
      },
    },
  },
  {
    traceId: "trace-2",
    rootSpan: {
      attributes: "{}",
      cumulativeTokenCountTotal: 5,
      endTime: "2026-07-22T12:01:01.000Z",
      id: "span-node-2",
      input: null,
      latencyMs: 1000,
      name: "Second turn",
      output: null,
      project: { id: "project-1" },
      spanId: "span-2",
      startTime: "2026-07-22T12:01:00.000Z",
      trace: {
        costSummary: { total: { cost: null } },
        id: "trace-node-2",
      },
    },
  },
] as unknown as ReadonlyArray<SessionTurnRow>;

describe("SessionTurnList", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderTurnList({
    onTurnClick,
    onTurnDoubleClick,
  }: {
    onTurnClick: (traceId: string) => void;
    onTurnDoubleClick: (turn: { traceId: string; spanNodeId: string }) => void;
  }) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark">
          <PreferencesProvider>
            <SessionTurnList
              rows={rows}
              selectedTraceId={null}
              onTurnClick={onTurnClick}
              onTurnDoubleClick={onTurnDoubleClick}
            />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  it("keeps a single click scoped to turn selection", async () => {
    const onTurnClick = vi.fn();
    const onTurnDoubleClick = vi.fn();
    renderTurnList({ onTurnClick, onTurnDoubleClick });
    const turn = container.querySelectorAll<HTMLElement>('[role="option"]')[1];
    expect(turn).toBeInstanceOf(HTMLElement);

    await act(async () => {
      await userEvent.setup().click(turn as HTMLElement);
    });

    expect(onTurnClick).toHaveBeenCalledWith("trace-2");
    expect(onTurnDoubleClick).not.toHaveBeenCalled();
  });

  it("identifies the trace and root span when a turn is double-clicked", async () => {
    const onTurnClick = vi.fn();
    const onTurnDoubleClick = vi.fn();
    renderTurnList({ onTurnClick, onTurnDoubleClick });
    const turn = container.querySelectorAll<HTMLElement>('[role="option"]')[1];
    expect(turn).toBeInstanceOf(HTMLElement);

    await act(async () => {
      await userEvent.setup().dblClick(turn as HTMLElement);
    });

    expect(onTurnDoubleClick).toHaveBeenCalledOnce();
    expect(onTurnDoubleClick).toHaveBeenCalledWith({
      traceId: "trace-2",
      spanNodeId: "span-node-2",
    });
  });
});
