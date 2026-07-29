import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import type * as DateTimeModule from "@phoenix/components/datetime";
import type * as PhoenixTableModule from "@phoenix/components/table";
import { ThemeProvider } from "@phoenix/contexts";

installTestMatchMedia();

const relayMocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  usePaginationFragment: vi.fn(),
}));

const fieldMocks = vi.hoisted(() => ({
  props: null as null | {
    onValidCondition: (args: {
      condition: string;
      selectsRootSpansOnly: boolean | null;
    }) => void;
  },
}));

const tracingState = vi.hoisted(() => ({
  annotationColumnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnVisibility: {},
  projectId: "project-integration",
  setColumnOrder: vi.fn(),
  setColumnSizing: vi.fn(),
  traceAnnotationColumnVisibility: {},
}));

const timeRangeState = vi.hoisted(() => ({
  timeRangeISOStrings: {
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-07-02T00:00:00.000Z",
  },
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  usePaginationFragment: relayMocks.usePaginationFragment,
}));

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => timeRangeState,
}));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: 0 }),
}));

vi.mock("@phoenix/contexts/TracingContext", () => ({
  useTracingContext: (selector: (state: typeof tracingState) => unknown) =>
    selector(tracingState),
}));

vi.mock("@phoenix/pages/trace/TracePaginationContext", () => ({
  useTracePagination: () => null,
}));

vi.mock("@phoenix/components/table/useShiftClickRowSelection", () => ({
  useShiftClickRowSelection: () => ({ selectRow: vi.fn() }),
}));

vi.mock("@phoenix/components/table", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixTableModule>()),
  useColumnOrder: () => ({
    getColumnOrderIndex: () => 0,
    leafColumnOrder: [],
    onVisibleColumnOrderChange: vi.fn(),
    visibleColumnOrder: [],
  }),
  useTableRowsExpanded: () => ({
    isExpanded: false,
    setIsExpanded: vi.fn(),
    tableProps: {},
  }),
}));

vi.mock("../SpanFilterConditionField", async () => {
  const React = await import("react");
  return {
    SpanFilterConditionField: (props: NonNullable<typeof fieldMocks.props>) => {
      fieldMocks.props = props;
      return React.createElement("div", null, "filter field");
    },
  };
});

vi.mock("../SpanColumnSelector", () => ({
  SpanColumnSelector: () => null,
}));

vi.mock("../SpansTableAside", () => ({
  SpansTableAside: () => null,
}));

vi.mock("../TableAside", async () => {
  const React = await import("react");
  return {
    TableAsidePanel: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    TableAsideToggleButton: () => null,
  };
});

vi.mock("../TableMetricsCharts", async () => {
  const React = await import("react");
  return {
    TableMetricsChartsPanelGroup: ({
      children,
    }: {
      children: React.ReactNode;
    }) => React.createElement("div", null, children),
  };
});

vi.mock("../TableMetricsChartSelector", () => ({
  TableMetricsChartSelector: () => null,
}));

import type { SpansTable_spans$key } from "../__generated__/SpansTable_spans.graphql";
import type { SpanFilterSeed } from "../spanFilterSeed";
import { SpansTable } from "../SpansTable";

const customSeed: SpanFilterSeed = {
  condition: "status_code == 'ERROR'",
  requiresServerValidation: true,
};

describe("SpansTable seed loading integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestOnComplete: ((error: Error | null) => void) | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestOnComplete = null;
    fieldMocks.props = null;
    relayMocks.refetch.mockReset();
    relayMocks.refetch.mockImplementation(
      (
        _variables: unknown,
        options: { onComplete: (error: Error | null) => void }
      ) => {
        latestOnComplete = options.onComplete;
      }
    );
    relayMocks.usePaginationFragment.mockReturnValue({
      data: {
        name: "integration project",
        spanAnnotationNames: [],
        spans: { edges: [] },
      },
      hasNext: false,
      isLoadingNext: false,
      loadNext: vi.fn(),
      refetch: relayMocks.refetch,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps fallback rows hidden and retries a failed matching refetch", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <MemoryRouter
            initialEntries={["/projects/project-integration/spans"]}
          >
            <SpansTable
              project={{} as SpansTable_spans$key}
              seed={customSeed}
            />
          </MemoryRouter>
        </ThemeProvider>
      );
    });

    expect(relayMocks.refetch).not.toHaveBeenCalled();
    expect(container.querySelector("table")).toBeNull();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: customSeed.condition,
        selectsRootSpansOnly: false,
      });
    });
    expect(relayMocks.refetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      latestOnComplete?.(new Error("network failed"));
    });
    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry"
    );
    expect(retryButton).toBeDefined();
    expect(container.querySelector("table")).toBeNull();

    await act(async () => {
      retryButton?.click();
    });
    expect(relayMocks.refetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      latestOnComplete?.(null);
    });
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.textContent).not.toContain("Retry");
  });
});
