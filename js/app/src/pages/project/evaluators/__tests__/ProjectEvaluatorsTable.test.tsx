import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  loadQuery,
  type PreloadedQuery,
  RelayEnvironmentProvider,
  usePreloadedQuery,
} from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  Environment,
  getRequest,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { createStreamingMultipartResponse } from "@phoenix/__tests__/multipartResponse";
import type * as DateTimeModule from "@phoenix/components/datetime";
import type { OpenTimeRangeWithKey } from "@phoenix/components/datetime/types";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import {
  PROJECT_EVALUATORS_TABLE_STORAGE_KEY,
  ProjectEvaluatorsTableProvider,
} from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { getUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

installTestMatchMedia();

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

const PAGE_TIME_RANGE: OpenTimeRangeWithKey = {
  timeRangeKey: "custom",
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-07-08T00:00:00.000Z"),
};

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => ({ timeRange: PAGE_TIME_RANGE }),
}));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: 0 }),
}));

import type { projectEvaluatorsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorsLoaderQuery.graphql";
import type { EvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";
import { getEvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";
import { projectEvaluatorsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import { ProjectEvaluatorsTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";
import { fetchRelay } from "@phoenix/RelayEnvironment";

const PROJECT_ID = "UHJvamVjdDox";
const TIME_RANGE = {
  start: PAGE_TIME_RANGE.start?.toISOString(),
  end: PAGE_TIME_RANGE.end?.toISOString(),
};
const SCORE_WINDOW = getEvaluatorScoreWindow({
  timeRange: PAGE_TIME_RANGE,
  utcOffsetMinutes: getUTCOffsetMinutes(),
});
/** A window the table does not compute, so loading with it makes the table refetch. */
const STALE_SCORE_WINDOW: EvaluatorScoreWindow = {
  ...SCORE_WINDOW,
  timeBinConfig: { ...SCORE_WINDOW.timeBinConfig, scale: "HOUR" },
};
/** The label the route query gives the deferred scores fragment. */
const DEFER_LABEL = /@defer\(label: "([^"]+)"\)/.exec(
  getRequest(projectEvaluatorsLoaderGQL).params.text ?? ""
)?.[1];

/** Every column but the name and the results stays hidden. */
const HIDDEN_COLUMN_IDS = [
  "select",
  "enabled",
  "status",
  "queue",
  "load",
  "lag",
  "failures",
  "kind",
  "prompt",
  "model",
  "cost",
  "averageCost",
  "language",
  "sandbox",
  "target",
  "filter",
  "sampling",
  "updatedAt",
  "actions",
];

function makeEvaluatorNode(index: number) {
  return {
    __typename: "ProjectEvaluator",
    id: `ProjectEvaluator:${index}`,
    name: `evaluator-${index}`,
    evaluationTarget: "SPAN",
    filterCondition: null,
    samplingRate: 1,
    enabled: true,
    updatedAt: "2026-07-01T00:00:00+00:00",
    runSummary: {
      status: "HEALTHY",
      lastRunAt: null,
      queuedCount: 0,
      runningCount: 0,
      evaluatedCount: 0,
      failedCount: 0,
      clearedCount: 0,
      oldestWaitingOrRetryingAt: null,
    },
    tracingEnabled: true,
    evaluationLoad: {
      evaluationCount: 0,
      meanEvaluationSeconds: null,
      shareOfEvaluationTime: null,
      excludesUntracedEvaluators: false,
    },
    evaluator: {
      __typename: "CodeEvaluator",
      id: `CodeEvaluator:${index}`,
      kind: "CODE",
      outputConfigs: [
        {
          __typename: "ContinuousAnnotationConfig",
          __isAnnotationConfigBase: "ContinuousAnnotationConfig",
          name: `evaluator-${index}`,
          annotationType: "CONTINUOUS",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 1,
          __isNode: "ContinuousAnnotationConfig",
          id: `ContinuousAnnotationConfig:${index}`,
        },
      ],
      language: "PYTHON",
      sandboxConfig: null,
    },
    traceProject: {
      id: `Project:${index + 100}`,
      traceCount: 0,
      costSummary: {
        total: { cost: null },
        prompt: { cost: null },
        completion: { cost: null },
      },
    },
    failureSummary: {
      failedCount: 0,
      evaluatedCount: 0,
      failureRate: null,
      lastFailedAt: null,
      lastError: null,
    },
    lag: { p50Seconds: null, p95Seconds: null, p99Seconds: null },
  };
}

/**
 * The first part of a response for one page of evaluators, its scores
 * deferred, under `root` (`project` for the route query, `node` for the
 * table's refetch and pagination query).
 */
function makeInitialPart({
  root,
  indexes,
  hasNextPage = false,
}: {
  root: "project" | "node";
  indexes: number[];
  hasNextPage?: boolean;
}) {
  return {
    data: {
      [root]: {
        __typename: "Project",
        ...(root === "project" ? { evaluatorCount: indexes.length } : {}),
        evaluators: {
          edges: indexes.map((index) => ({
            node: makeEvaluatorNode(index),
            cursor: `cursor-${index}`,
          })),
          pageInfo: {
            endCursor: `cursor-${indexes[indexes.length - 1]}`,
            hasNextPage,
          },
        },
        id: PROJECT_ID,
      },
    },
    hasNext: true,
    pending: indexes.map((index, position) => ({
      id: String(index),
      path: [root, "evaluators", "edges", position, "node"],
      label: DEFER_LABEL,
    })),
  };
}

function makeScoresPart({
  indexes,
  meanScore,
}: {
  indexes: number[];
  meanScore: number;
}) {
  return {
    hasNext: false,
    incremental: indexes.map((index) => ({
      id: String(index),
      data: {
        annotationScoreMetrics: [
          {
            annotationName: `evaluator-${index}`,
            summary: {
              meanScore,
              count: 10,
              scoreCount: 10,
              labelCount: 0,
              labelFractions: [],
            },
            previousSummary: { meanScore: null, labelFractions: [] },
            series: [],
          },
        ],
      },
    })),
    completed: indexes.map((index) => ({ id: String(index) })),
  };
}

function makeFailedScoresPart({ indexes }: { indexes: number[] }) {
  return {
    hasNext: false,
    completed: indexes.map((index) => ({
      id: String(index),
      errors: [{ message: "an unexpected error occurred" }],
    })),
  };
}

function TableOwner({
  queryRef,
  initialScoreWindow,
}: {
  queryRef: PreloadedQuery<projectEvaluatorsLoaderQuery>;
  initialScoreWindow: EvaluatorScoreWindow;
}) {
  const data = usePreloadedQuery<projectEvaluatorsLoaderQuery>(
    projectEvaluatorsLoaderGQL,
    queryRef
  );
  if (data.project == null) {
    throw new Error("project is required");
  }
  return (
    <ProjectEvaluatorsTable
      project={data.project}
      projectId={PROJECT_ID}
      filter=""
      timeRange={TIME_RANGE}
      initialFilter=""
      initialTimeRange={TIME_RANGE}
      initialScoreWindow={initialScoreWindow}
      initialIncludeMeanScore
      initialRequest={queryRef.source}
      selection={{}}
      onSelectionChange={() => {}}
    />
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  authFetchMock.mockReset();
  localStorage.setItem(
    PROJECT_EVALUATORS_TABLE_STORAGE_KEY,
    JSON.stringify({
      state: {
        columnVisibility: Object.fromEntries(
          HIDDEN_COLUMN_IDS.map((columnId) => [columnId, false])
        ),
      },
      version: 1,
    })
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function renderTable({
  initialScoreWindow = SCORE_WINDOW,
}: { initialScoreWindow?: EvaluatorScoreWindow } = {}) {
  const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
  });
  const queryRef = loadQuery<projectEvaluatorsLoaderQuery>(
    environment,
    projectEvaluatorsLoaderGQL,
    {
      projectId: PROJECT_ID,
      filter: null,
      timeRange: TIME_RANGE,
      scoreTimeRange: initialScoreWindow.timeRange,
      scorePreviousTimeRange: initialScoreWindow.previousTimeRange,
      scoreTimeBinConfig: initialScoreWindow.timeBinConfig,
      includeMeanScore: true,
    },
    { fetchPolicy: "store-and-network" }
  );
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <PreferencesProvider>
          <RelayEnvironmentProvider environment={environment}>
            <MemoryRouter
              initialEntries={[`/projects/${PROJECT_ID}/evaluators`]}
            >
              <Routes>
                <Route
                  path="/projects/:projectId/evaluators"
                  element={
                    <ProjectEvaluatorsTableProvider>
                      <Suspense fallback="loading">
                        <TableOwner
                          queryRef={queryRef}
                          initialScoreWindow={initialScoreWindow}
                        />
                      </Suspense>
                    </ProjectEvaluatorsTableProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </RelayEnvironmentProvider>
        </PreferencesProvider>
      </ThemeProvider>
    );
  });
}

/** Lets streamed parts reach Relay and React render what they wrote. */
async function settle() {
  await act(async () => {
    for (let turn = 0; turn < 10; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** What each row's results cell shows, by evaluator name. */
function readResultsCells() {
  return Object.fromEntries(
    [...container.querySelectorAll("tbody tr")].map((row) => {
      const [nameCell, resultsCell] = row.querySelectorAll("td");
      const result = resultsCell?.querySelector('[aria-label="Loading scores"]')
        ? "loading"
        : (resultsCell?.textContent ?? "");
      return [nameCell?.textContent ?? "", result];
    })
  );
}

describe("ProjectEvaluatorsTable results column", () => {
  it("fills in the scores when their part arrives", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(makeInitialPart({ root: "project", indexes: [1, 2] }));
    await settle();
    expect(readResultsCells()).toEqual({
      "evaluator-1": "loading",
      "evaluator-2": "loading",
    });

    stream.sendPart(makeScoresPart({ indexes: [1, 2], meanScore: 0.75 }));
    stream.end();
    await settle();

    expect(readResultsCells()).toEqual({
      "evaluator-1": expect.stringContaining("0.75"),
      "evaluator-2": expect.stringContaining("0.75"),
    });
  });

  it.each([
    {
      failure: "a scores part that reports errors",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) => {
        stream.sendPart(makeFailedScoresPart({ indexes: [1, 2] }));
        stream.end();
      },
    },
    {
      failure: "a response that ends before the scores",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.cutOff(),
    },
    {
      failure: "a connection lost before the scores",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.fail(new TypeError("network error")),
    },
  ])("shows the failed state after $failure", async ({ fail }) => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(makeInitialPart({ root: "project", indexes: [1, 2] }));
    await settle();

    fail(stream);
    await settle();

    expect(readResultsCells()).toEqual({
      "evaluator-1": "error",
      "evaluator-2": "error",
    });
  });

  it("shows the failed state when a refetch's scores fail", async () => {
    const load = createStreamingMultipartResponse();
    const refetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refetch.response);
    await renderTable({ initialScoreWindow: STALE_SCORE_WINDOW });
    load.sendPart(makeInitialPart({ root: "project", indexes: [1] }));
    load.sendPart(makeScoresPart({ indexes: [1], meanScore: 0.75 }));
    load.end();
    await settle();

    refetch.sendPart(makeInitialPart({ root: "node", indexes: [1] }));
    refetch.sendPart(makeFailedScoresPart({ indexes: [1] }));
    refetch.end();
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readResultsCells()).toEqual({ "evaluator-1": "error" });
  });

  it("shows the failed state only on the rows whose next page of scores failed", async () => {
    const load = createStreamingMultipartResponse();
    const nextPage = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(nextPage.response);
    await renderTable();
    load.sendPart(
      makeInitialPart({ root: "project", indexes: [1], hasNextPage: true })
    );
    load.sendPart(makeScoresPart({ indexes: [1], meanScore: 0.75 }));
    load.end();
    await settle();

    const loadMoreButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load More"
    );
    await act(async () => {
      loadMoreButton?.click();
    });
    nextPage.sendPart(makeInitialPart({ root: "node", indexes: [2] }));
    nextPage.sendPart(makeFailedScoresPart({ indexes: [2] }));
    nextPage.end();
    await settle();

    expect(readResultsCells()).toEqual({
      "evaluator-1": expect.stringContaining("0.75"),
      "evaluator-2": "error",
    });
  });
});
