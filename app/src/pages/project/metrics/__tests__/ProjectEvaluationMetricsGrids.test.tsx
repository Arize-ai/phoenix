import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type { ConcreteRequest } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as PhoenixChart from "@phoenix/components/chart";

import {
  SessionEvaluationMetricsGrid,
  SpanEvaluationMetricsGrid,
  TraceEvaluationMetricsGrid,
} from "../ProjectEvaluationMetricsGrids";

const useLazyLoadQueryMock = vi.hoisted(() => vi.fn());

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useLazyLoadQuery: useLazyLoadQueryMock,
}));

vi.mock("@phoenix/hooks/useUTCOffsetMinutes", () => ({
  useUTCOffsetMinutes: () => 120,
}));

vi.mock("@phoenix/hooks/useTimeFormatters", () => ({
  useTimeFormatters: () => ({ fullTimeFormatter: () => "formatted time" }),
}));

vi.mock("@phoenix/components/chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixChart>()),
  useBinTimeTickFormatter: () => () => "formatted tick",
}));

describe("Project evaluation metrics query wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useLazyLoadQueryMock.mockReturnValue({
      project: {
        spanAnnotationMetricsTimeSeries: { data: [] },
        traceAnnotationMetricsTimeSeries: { data: [] },
        sessionAnnotationMetricsTimeSeries: { data: [] },
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useLazyLoadQueryMock.mockReset();
  });

  it.each([
    [
      "span",
      SpanEvaluationMetricsGrid,
      "ProjectEvaluationMetricsGridsSpanQuery",
    ],
    [
      "trace",
      TraceEvaluationMetricsGrid,
      "ProjectEvaluationMetricsGridsTraceQuery",
    ],
    [
      "session",
      SessionEvaluationMetricsGrid,
      "ProjectEvaluationMetricsGridsSessionQuery",
    ],
  ] as const)(
    "loads the %s time series with the shared range",
    async (_, Grid, queryName) => {
      const timeRange = {
        start: new Date("2024-01-01T00:00:00.000Z"),
        end: new Date("2024-01-03T00:00:00.000Z"),
      };

      await act(async () => {
        root.render(
          <Grid
            projectId="project-1"
            timeRange={timeRange}
            onTimeRangeSelected={vi.fn()}
          />
        );
      });

      expect(useLazyLoadQueryMock).toHaveBeenCalledOnce();
      const [query, variables] = useLazyLoadQueryMock.mock.calls[0] as [
        ConcreteRequest,
        Record<string, unknown>,
      ];
      expect(query.params.name).toBe(queryName);
      expect(variables).toEqual({
        projectId: "project-1",
        timeRange: {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-03T00:00:00.000Z",
        },
        timeBinConfig: {
          scale: "HOUR",
          utcOffsetMinutes: 120,
        },
      });
    }
  );
});
