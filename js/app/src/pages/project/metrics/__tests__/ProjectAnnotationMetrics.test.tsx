import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as PhoenixChart from "@phoenix/components/chart";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";

import { ProjectAnnotationMetricsGrid } from "../ProjectAnnotationMetrics";

vi.mock("@phoenix/components/chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixChart>()),
  ChartPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartSkeleton: () => <div>loading chart</div>,
}));

type RequestedOperation = {
  name: string;
  text: string | null | undefined;
  variables: Record<string, unknown>;
  resolve: (data: Record<string, unknown>) => void;
};

const PROJECT_ID = "project-1";
const TIME_RANGE = {
  start: new Date("2024-01-01T01:00:00.000Z"),
  end: new Date("2024-01-01T02:00:00.000Z"),
};
const TIME_RANGE_VARIABLE = {
  start: TIME_RANGE.start.toISOString(),
  end: TIME_RANGE.end.toISOString(),
};

const observedElements = new Map<Element, ControlledIntersectionObserver>();

class ControlledIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [];
  readonly #callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element) {
    observedElements.set(target, this);
  }

  unobserve(target: Element) {
    if (observedElements.get(target) === this) {
      observedElements.delete(target);
    }
  }

  disconnect() {
    for (const [target, observer] of observedElements) {
      if (observer === this) {
        observedElements.delete(target);
      }
    }
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  setIsIntersecting(target: Element, isIntersecting: boolean) {
    const rect = target.getBoundingClientRect();
    this.#callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: rect,
          isIntersecting,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this
    );
  }
}

const defaultIntersectionObserver = globalThis.IntersectionObserver;

function setIsIntersecting(target: Element, isIntersecting: boolean) {
  const observer = observedElements.get(target);
  if (observer == null) {
    throw new Error("Element is not observed");
  }
  observer.setIsIntersecting(target, isIntersecting);
}

const LEVEL_CASES: ReadonlyArray<{
  annotationLevel: MetricChartTableView;
  namesOperationName: string;
  namesField: string;
  metricsOperationName: string;
}> = [
  {
    annotationLevel: "spans",
    namesOperationName: "ProjectAnnotationMetricTimeRangeNamesSpanQuery",
    namesField: "spanAnnotationMetricNames",
    metricsOperationName: "ProjectAnnotationMetricsSpanQuery",
  },
  {
    annotationLevel: "traces",
    namesOperationName: "ProjectAnnotationMetricTimeRangeNamesTraceQuery",
    namesField: "traceAnnotationMetricNames",
    metricsOperationName: "ProjectAnnotationMetricsTraceQuery",
  },
  {
    annotationLevel: "sessions",
    namesOperationName: "ProjectAnnotationMetricTimeRangeNamesSessionQuery",
    namesField: "sessionAnnotationMetricNames",
    metricsOperationName: "ProjectAnnotationMetricsSessionQuery",
  },
];

describe("ProjectAnnotationMetricsGrid", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    observedElements.clear();
    globalThis.IntersectionObserver = ControlledIntersectionObserver;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.IntersectionObserver = defaultIntersectionObserver;
    vi.restoreAllMocks();
  });

  it.each(LEVEL_CASES)(
    "defers and independently loads $annotationLevel annotation metrics",
    async ({
      annotationLevel,
      namesOperationName,
      namesField,
      metricsOperationName,
    }) => {
      const requestedOperations: RequestedOperation[] = [];
      const environment = new Environment({
        network: Network.create((operation, variables) =>
          Observable.create((sink) => {
            requestedOperations.push({
              name: operation.name,
              text: operation.text,
              variables: variables as Record<string, unknown>,
              resolve: (data) => {
                sink.next({ data });
                sink.complete();
              },
            });
          })
        ),
        store: new Store(new RecordSource()),
      });

      await act(async () => {
        root.render(
          <RelayEnvironmentProvider environment={environment}>
            <ProjectAnnotationMetricsGrid
              annotationLevel={annotationLevel}
              projectId={PROJECT_ID}
              timeRange={TIME_RANGE}
            />
          </RelayEnvironmentProvider>
        );
      });

      expect(requestedOperations).toHaveLength(1);
      const namesOperation = requestedOperations[0];
      expect(namesOperation?.name).toBe(namesOperationName);
      expect(namesOperation?.variables).toEqual({
        projectId: PROJECT_ID,
        timeRange: TIME_RANGE_VARIABLE,
      });
      expect(namesOperation?.text).toContain(namesField);
      expect(namesOperation?.text).not.toContain("annotationSummaries");
      expect(namesOperation?.text).not.toContain("meanScore");
      expect(namesOperation?.text).not.toContain("labelFractions");

      await act(async () => {
        namesOperation?.resolve({
          project: {
            __typename: "Project",
            id: PROJECT_ID,
            [namesField]: ["quality", "toxicity"],
          },
        });
      });

      expect(requestedOperations).toHaveLength(1);
      const deferredPanels = container.querySelectorAll(
        ".deferred-chart-panel"
      );
      expect(deferredPanels).toHaveLength(2);

      await act(async () => {
        setIsIntersecting(deferredPanels[0]!, true);
      });

      let metricsOperations = requestedOperations.filter(
        ({ name }) => name === metricsOperationName
      );
      expect(metricsOperations).toHaveLength(1);
      expect(metricsOperations[0]?.variables.annotationName).toBe("quality");

      await act(async () => {
        setIsIntersecting(deferredPanels[1]!, true);
      });

      metricsOperations = requestedOperations.filter(
        ({ name }) => name === metricsOperationName
      );
      expect(metricsOperations).toHaveLength(2);
      expect(
        new Set(
          metricsOperations.map(({ variables }) => variables.annotationName)
        )
      ).toEqual(new Set(["quality", "toxicity"]));
      for (const metricsOperation of metricsOperations) {
        expect(metricsOperation.variables).toMatchObject({
          projectId: PROJECT_ID,
          timeRange: TIME_RANGE_VARIABLE,
        });
        expect(metricsOperation.variables.annotationName).toEqual(
          expect.any(String)
        );
      }
      expect(requestedOperations).toHaveLength(3);
    }
  );
});
