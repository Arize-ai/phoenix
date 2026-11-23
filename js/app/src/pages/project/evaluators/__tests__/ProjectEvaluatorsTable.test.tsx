import { act, Profiler, Suspense } from "react";
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

const streamState = vi.hoisted(() => ({ fetchKey: 0 }));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: streamState.fetchKey }),
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
/** A range the table does not show, so loading with it makes the table refetch. */
const STALE_TIME_RANGE = { ...TIME_RANGE, start: "2026-06-30T00:00:00.000Z" };
/**
 * The label the route query gives the deferred fragment named `fragmentName`.
 * Relay labels a deferred fragment `<parent>$defer$<fragment>`, and a fragment
 * deferred inside another carries the outer one's name as its parent, so only
 * the part after `$defer$` identifies the fragment.
 */
function getDeferLabel(fragmentName: string) {
  const text = getRequest(projectEvaluatorsLoaderGQL).params.text ?? "";
  return [...text.matchAll(/@defer\(label: "([^"]+)"\)/g)]
    .map((match) => match[1])
    .find((label) => label.includes(`$defer$${fragmentName}`));
}
const SCORES_DEFER_LABEL = getDeferLabel(
  "ProjectEvaluatorMeanScoreCell_scores"
);
const COST_DEFER_LABEL = getDeferLabel("ProjectEvaluatorCost_cost");
const PREVIOUS_WINDOW_DEFER_LABEL = getDeferLabel(
  "ProjectEvaluatorMeanScoreCell_previousSummary"
);

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

type EvaluatorFixtureKind = "CODE" | "BUILTIN" | "LLM" | "DECISION";

/** Each kind's evaluator selections, as the row fragment reads them. */
function makeEvaluator({
  index,
  kind,
}: {
  index: number;
  kind: EvaluatorFixtureKind;
}) {
  const outputConfigs = [
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
  ];
  switch (kind) {
    case "CODE":
      return {
        __typename: "CodeEvaluator",
        id: `CodeEvaluator:${index}`,
        kind,
        outputConfigs,
        language: "PYTHON",
        sandboxConfig: null,
      };
    case "BUILTIN":
      return {
        __typename: "BuiltInEvaluator",
        id: `BuiltInEvaluator:${index}`,
        kind,
        outputConfigs,
      };
    case "DECISION":
      return {
        __typename: "DecisionEvaluator",
        id: `DecisionEvaluator:${index}`,
        kind,
        outputConfigs,
        decisionVersionTag: {
          name: `judge-${index}`,
          id: `DecisionVersionTag:${index}`,
        },
        decisionVersion: {
          id: `DecisionVersion:${index}`,
          decisionId: `Decision:${index}`,
          decision: { name: `decision-${index}`, id: `Decision:${index}` },
          modelName: "jev-latest",
          modelProvider: "TYPESAFE",
        },
      };
    default:
      return {
        __typename: "LLMEvaluator",
        id: `LLMEvaluator:${index}`,
        kind,
        outputConfigs,
        prompt: { id: `Prompt:${index}`, name: `prompt-${index}` },
        promptVersionTag: null,
        promptVersion: {
          modelName: "gpt-4o",
          modelProvider: "OPENAI",
          id: `PromptVersion:${index}`,
        },
      };
  }
}

type EvaluatorNodeFixtureOptions = {
  kind?: EvaluatorFixtureKind;
  tracingEnabled?: boolean;
};

function makeEvaluatorNode({
  index,
  kind = "CODE",
  tracingEnabled = true,
}: { index: number } & EvaluatorNodeFixtureOptions) {
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
    tracingEnabled,
    evaluationLoad: {
      evaluationCount: 0,
      meanEvaluationSeconds: null,
      shareOfEvaluationTime: null,
      excludesUntracedEvaluators: false,
    },
    evaluator: makeEvaluator({ index, kind }),
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
  nodes = {},
}: {
  root: "project" | "node";
  indexes: number[];
  hasNextPage?: boolean;
  /** Per-row fixture options, by index; rows default to traced code evaluators. */
  nodes?: Record<number, EvaluatorNodeFixtureOptions>;
}) {
  return {
    data: {
      [root]: {
        __typename: "Project",
        ...(root === "project" ? { evaluatorCount: indexes.length } : {}),
        evaluators: {
          edges: indexes.map((index) => ({
            node: makeEvaluatorNode({ index, ...nodes[index] }),
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
    pending: indexes.flatMap((index, position) => [
      {
        id: String(index),
        path: [root, "evaluators", "edges", position, "node"],
        label: SCORES_DEFER_LABEL,
      },
      {
        id: `cost-${index}`,
        path: [root, "evaluators", "edges", position, "node"],
        label: COST_DEFER_LABEL,
      },
    ]),
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

/**
 * A scores part for the route query's rows that carries the current window
 * and announces the previous window's part.
 */
function makeCurrentScoresPart({
  indexes,
  meanScore,
}: {
  indexes: number[];
  meanScore: number;
}) {
  return {
    hasNext: true,
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
            series: [],
          },
        ],
      },
    })),
    pending: indexes.map((index, position) => ({
      id: `previous-${index}`,
      path: [
        "project",
        "evaluators",
        "edges",
        position,
        "node",
        "annotationScoreMetrics",
        0,
      ],
      label: PREVIOUS_WINDOW_DEFER_LABEL,
    })),
    completed: indexes.map((index) => ({ id: String(index) })),
  };
}

function makePreviousWindowPart({
  indexes,
  meanScore,
}: {
  indexes: number[];
  meanScore: number;
}) {
  return {
    hasNext: false,
    incremental: indexes.map((index) => ({
      id: `previous-${index}`,
      data: { previousSummary: { meanScore, labelFractions: [] } },
    })),
    completed: indexes.map((index) => ({ id: `previous-${index}` })),
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

/** The cost part for the given rows, with each row's cost or null where unmeasured. */
function makeCostPart({
  costs,
  hasNext = false,
}: {
  costs: Record<
    number,
    { totalCost: number; tracedEvaluationCount: number } | null
  >;
  hasNext?: boolean;
}) {
  return {
    hasNext,
    incremental: Object.entries(costs).map(([index, cost]) => ({
      id: `cost-${index}`,
      data: {
        tracedEvaluationCount: cost?.tracedEvaluationCount ?? null,
        costSummary:
          cost == null
            ? null
            : {
                total: { cost: cost.totalCost },
                prompt: { cost: cost.totalCost / 2 },
                completion: { cost: cost.totalCost / 2 },
              },
      },
    })),
    completed: Object.keys(costs).map((index) => ({ id: `cost-${index}` })),
  };
}

function makeFailedCostPart({ indexes }: { indexes: number[] }) {
  return {
    hasNext: false,
    completed: indexes.map((index) => ({
      id: `cost-${index}`,
      errors: [{ message: "an unexpected error occurred" }],
    })),
  };
}

function TableOwner({
  queryRef,
  timeRange,
  initialTimeRange,
  initialScoreWindow,
  onTableCommit,
}: {
  queryRef: PreloadedQuery<projectEvaluatorsLoaderQuery>;
  timeRange: typeof TIME_RANGE;
  initialTimeRange: typeof TIME_RANGE;
  initialScoreWindow: EvaluatorScoreWindow;
  onTableCommit: () => void;
}) {
  const data = usePreloadedQuery<projectEvaluatorsLoaderQuery>(
    projectEvaluatorsLoaderGQL,
    queryRef
  );
  if (data.project == null) {
    throw new Error("project is required");
  }
  return (
    <Profiler id="table" onRender={onTableCommit}>
      <ProjectEvaluatorsTable
        project={data.project}
        projectId={PROJECT_ID}
        filter=""
        timeRange={timeRange}
        initialFilter=""
        initialTimeRange={initialTimeRange}
        initialScoreWindow={initialScoreWindow}
        initialIncludeMeanScore
        initialRequest={queryRef.source}
        selection={{}}
        onSelectionChange={() => {}}
      />
    </Profiler>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  authFetchMock.mockReset();
  streamState.fetchKey = 0;
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
  initialTimeRange = TIME_RANGE,
  initialScoreWindow = SCORE_WINDOW,
  onTableCommit = () => {},
}: {
  initialTimeRange?: typeof TIME_RANGE;
  initialScoreWindow?: EvaluatorScoreWindow;
  onTableCommit?: () => void;
} = {}) {
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
      timeRange: initialTimeRange,
      scoreTimeRange: initialScoreWindow.timeRange,
      scorePreviousTimeRange: initialScoreWindow.previousTimeRange,
      scoreTimeBinConfig: initialScoreWindow.timeBinConfig,
      includeMeanScore: true,
    },
    { fetchPolicy: "store-and-network" }
  );
  const renderOwner = (
    ownerScoreWindow: EvaluatorScoreWindow,
    timeRange: typeof TIME_RANGE = TIME_RANGE
  ) =>
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
                          timeRange={timeRange}
                          initialTimeRange={initialTimeRange}
                          initialScoreWindow={ownerScoreWindow}
                          onTableCommit={onTableCommit}
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
  await act(async () => renderOwner(initialScoreWindow));
  return {
    /**
     * Re-renders the owner, as a parent render or a loader revalidation does,
     * or with the table's time range changed, as picking another range does.
     */
    rerender: ({
      initialScoreWindow: ownerScoreWindow = initialScoreWindow,
      timeRange,
    }: {
      initialScoreWindow?: EvaluatorScoreWindow;
      timeRange?: typeof TIME_RANGE;
    } = {}) => act(async () => renderOwner(ownerScoreWindow, timeRange)),
  };
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

/** How many results cells show the change vs. the previous window as loading. */
function countLoadingChanges() {
  return container.querySelectorAll('[aria-label="Loading change"]').length;
}

/** How many results cells show that the change vs. the previous window failed. */
function countFailedChanges() {
  return container.querySelectorAll(
    '[role="img"][aria-label="Change failed to load"]'
  ).length;
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

  it("keeps the current scores while the previous window loads", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(makeInitialPart({ root: "project", indexes: [1, 2] }));
    stream.sendPart(
      makeCurrentScoresPart({ indexes: [1, 2], meanScore: 0.75 })
    );
    await settle();
    const currentScoreOnly = expect.stringMatching(/0\.75$/);
    expect(readResultsCells()).toEqual({
      "evaluator-1": currentScoreOnly,
      "evaluator-2": currentScoreOnly,
    });
    expect(countLoadingChanges()).toBe(2);

    stream.sendPart(
      makePreviousWindowPart({ indexes: [1, 2], meanScore: 0.5 })
    );
    stream.end();
    await settle();

    const scoreWithChange = expect.stringMatching(/0\.75▲ 0\.25$/);
    expect(readResultsCells()).toEqual({
      "evaluator-1": scoreWithChange,
      "evaluator-2": scoreWithChange,
    });
    expect(countLoadingChanges()).toBe(0);
  });

  it.each([
    { previousWindow: "no results", previousSummary: null },
    {
      previousWindow: "results without a score",
      previousSummary: { meanScore: null, labelFractions: [] },
    },
  ])(
    "shows no change, not a loading one, when the previous window has $previousWindow",
    async ({ previousSummary }) => {
      const stream = createStreamingMultipartResponse();
      authFetchMock.mockResolvedValueOnce(stream.response);
      await renderTable();
      stream.sendPart(makeInitialPart({ root: "project", indexes: [1] }));
      stream.sendPart(makeCurrentScoresPart({ indexes: [1], meanScore: 0.75 }));
      stream.sendPart({
        hasNext: false,
        incremental: [{ id: "previous-1", data: { previousSummary } }],
        completed: [{ id: "previous-1" }],
      });
      stream.end();
      await settle();

      expect(readResultsCells()).toEqual({
        "evaluator-1": expect.stringMatching(/0\.75$/),
      });
      expect(countLoadingChanges()).toBe(0);
    }
  );

  it.each([
    {
      failure: "a previous window part that reports errors",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) => {
        stream.sendPart({
          hasNext: false,
          completed: [1, 2].map((index) => ({
            id: `previous-${index}`,
            errors: [{ message: "an unexpected error occurred" }],
          })),
        });
        stream.end();
      },
    },
    {
      failure: "a response that ends before the previous window",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.cutOff(),
    },
  ])(
    "keeps the current scores and says the change failed to load after $failure",
    async ({ fail }) => {
      const stream = createStreamingMultipartResponse();
      authFetchMock.mockResolvedValueOnce(stream.response);
      await renderTable();
      stream.sendPart(makeInitialPart({ root: "project", indexes: [1, 2] }));
      stream.sendPart(
        makeCurrentScoresPart({ indexes: [1, 2], meanScore: 0.75 })
      );
      await settle();

      fail(stream);
      await settle();

      const currentScoreOnly = expect.stringMatching(/0\.75$/);
      expect(readResultsCells()).toEqual({
        "evaluator-1": currentScoreOnly,
        "evaluator-2": currentScoreOnly,
      });
      expect(countFailedChanges()).toBe(2);
      expect(countLoadingChanges()).toBe(0);
    }
  );

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

  it("does not refetch when re-rendered with equal initial query inputs", async () => {
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response);
    const { rerender } = await renderTable();
    load.sendPart(makeInitialPart({ root: "project", indexes: [1] }));
    load.sendPart(makeScoresPart({ indexes: [1], meanScore: 0.75 }));
    load.end();
    await settle();

    await rerender({ initialScoreWindow: { ...SCORE_WINDOW } });
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not keep re-rendering while a refetch of rows already in the store is in flight", async () => {
    const load = createStreamingMultipartResponse();
    const firstRefetch = createStreamingMultipartResponse();
    const secondRefetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(firstRefetch.response)
      .mockResolvedValueOnce(secondRefetch.response);
    const MAX_TABLE_COMMITS = 100;
    let numTableCommits = 0;
    const { rerender } = await renderTable({
      initialScoreWindow: STALE_SCORE_WINDOW,
      onTableCommit: () => {
        numTableCommits++;
        // Unmounts the tree: the loop otherwise runs inside act until the
        // worker runs out of memory, since the refetch never completes.
        if (numTableCommits > MAX_TABLE_COMMITS) {
          throw new Error("ProjectEvaluatorsTable kept re-rendering");
        }
      },
    });
    load.sendPart(makeInitialPart({ root: "project", indexes: [1] }));
    load.sendPart(makeScoresPart({ indexes: [1], meanScore: 0.75 }));
    load.end();
    firstRefetch.sendPart(makeInitialPart({ root: "node", indexes: [1] }));
    firstRefetch.sendPart(makeScoresPart({ indexes: [1], meanScore: 0.75 }));
    firstRefetch.end();
    await settle();
    expect(authFetchMock).toHaveBeenCalledTimes(2);

    numTableCommits = 0;
    streamState.fetchKey++;
    await rerender();
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(3);
    expect(numTableCommits).toBeLessThan(10);
    secondRefetch.end();
    await settle();
  });
});

/** What each row's total and average cost cells show, by evaluator name. */
function readCostCells() {
  const read = (cell: Element | undefined) =>
    cell?.querySelector('[aria-label="Loading cost"]')
      ? "loading"
      : (cell?.textContent ?? "");
  return Object.fromEntries(
    [...container.querySelectorAll("tbody tr")].map((row) => {
      // The name, results, total cost and average cost columns are visible.
      const [nameCell, , costCell, averageCostCell] =
        row.querySelectorAll("td");
      return [
        nameCell?.textContent ?? "",
        [read(costCell), read(averageCostCell)],
      ];
    })
  );
}

describe("ProjectEvaluatorsTable cost columns", () => {
  /** Rows of each kind; only the traced LLM and decision evaluators' costs are measured. */
  const COST_ROWS = {
    1: { kind: "CODE" },
    2: { kind: "BUILTIN" },
    3: { kind: "LLM", tracingEnabled: false },
    4: { kind: "LLM" },
    5: { kind: "DECISION" },
  } as const;

  beforeEach(() => {
    localStorage.setItem(
      PROJECT_EVALUATORS_TABLE_STORAGE_KEY,
      JSON.stringify({
        state: {
          columnVisibility: Object.fromEntries(
            HIDDEN_COLUMN_IDS.filter(
              (columnId) => columnId !== "cost" && columnId !== "averageCost"
            ).map((columnId) => [columnId, false])
          ),
        },
        version: 1,
      })
    );
  });

  it("shows unmeasured costs at once and fills in the rest when their part arrives", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(
      makeInitialPart({
        root: "project",
        indexes: [1, 2, 3, 4, 5],
        nodes: COST_ROWS,
      })
    );
    await settle();

    expect(readCostCells()).toEqual({
      "evaluator-1": ["--", "--"],
      "evaluator-2": ["--", "--"],
      "evaluator-3": ["tracing off", "tracing off"],
      "evaluator-4": ["loading", "loading"],
      "evaluator-5": ["loading", "loading"],
    });

    stream.sendPart(
      makeScoresPart({ indexes: [1, 2, 3, 4, 5], meanScore: 0.75 })
    );
    stream.sendPart(
      makeCostPart({
        costs: {
          1: null,
          2: null,
          3: null,
          4: { totalCost: 0.5, tracedEvaluationCount: 2 },
          5: { totalCost: 0.9, tracedEvaluationCount: 3 },
        },
      })
    );
    stream.end();
    await settle();

    const costs = readCostCells();
    expect(costs["evaluator-3"]).toEqual(["tracing off", "tracing off"]);
    expect(costs["evaluator-4"]).toEqual([
      expect.stringContaining("0.5"),
      expect.stringContaining("0.25"),
    ]);
    expect(costs["evaluator-5"]).toEqual([
      expect.stringContaining("0.9"),
      expect.stringContaining("0.3"),
    ]);
  });

  it("keeps measured costs loading until a refetch's cost part arrives", async () => {
    const load = createStreamingMultipartResponse();
    const refetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refetch.response);
    await renderTable({ initialTimeRange: STALE_TIME_RANGE });
    load.sendPart(
      makeInitialPart({
        root: "project",
        indexes: [1, 2, 3, 4],
        nodes: COST_ROWS,
      })
    );
    load.sendPart(makeScoresPart({ indexes: [1, 2, 3, 4], meanScore: 0.75 }));
    load.sendPart(
      makeCostPart({
        costs: {
          1: null,
          2: null,
          3: null,
          4: { totalCost: 0.5, tracedEvaluationCount: 2 },
        },
      })
    );
    load.end();
    await settle();

    refetch.sendPart(
      makeInitialPart({ root: "node", indexes: [1, 2, 3, 4], nodes: COST_ROWS })
    );
    refetch.sendPart(
      makeScoresPart({ indexes: [1, 2, 3, 4], meanScore: 0.75 })
    );
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readCostCells()).toEqual({
      "evaluator-1": ["--", "--"],
      "evaluator-2": ["--", "--"],
      "evaluator-3": ["tracing off", "tracing off"],
      "evaluator-4": ["loading", "loading"],
    });

    refetch.sendPart(
      makeCostPart({
        costs: {
          1: null,
          2: null,
          3: null,
          4: { totalCost: 0.75, tracedEvaluationCount: 3 },
        },
      })
    );
    refetch.end();
    await settle();

    expect(readCostCells()["evaluator-4"]).toEqual([
      expect.stringContaining("0.75"),
      expect.stringContaining("0.25"),
    ]);
  });

  it("shows the failed state on measured costs whose part failed", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(
      makeInitialPart({
        root: "project",
        indexes: [1, 2, 3, 4],
        nodes: COST_ROWS,
      })
    );
    await settle();

    stream.sendPart(makeFailedCostPart({ indexes: [1, 2, 3, 4] }));
    stream.end();
    await settle();

    expect(readCostCells()).toEqual({
      "evaluator-1": ["--", "--"],
      "evaluator-2": ["--", "--"],
      "evaluator-3": ["tracing off", "tracing off"],
      "evaluator-4": ["error", "error"],
    });
  });

  /** A range the table has not loaded, as picking another range gives. */
  const OTHER_TIME_RANGE = {
    ...TIME_RANGE,
    start: "2026-06-29T00:00:00.000Z",
  };

  it("shows a refetch's pending costs and scores as loading after a failed load", async () => {
    const load = createStreamingMultipartResponse();
    const refetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refetch.response);
    const { rerender } = await renderTable();
    load.sendPart(
      makeInitialPart({ root: "project", indexes: [1, 4], nodes: COST_ROWS })
    );
    load.sendPart(makeFailedCostPart({ indexes: [1, 4] }));
    load.end();
    await settle();
    expect(readCostCells()["evaluator-4"]).toEqual(["error", "error"]);
    expect(readResultsCells()["evaluator-4"]).toBe("error");

    await rerender({ timeRange: OTHER_TIME_RANGE });
    refetch.sendPart(
      makeInitialPart({ root: "node", indexes: [1, 4], nodes: COST_ROWS })
    );
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readCostCells()["evaluator-4"]).toEqual(["loading", "loading"]);
    expect(readResultsCells()["evaluator-4"]).toBe("loading");
  });

  it("ignores a failure of the page's load that arrives after a refetch has started", async () => {
    const load = createStreamingMultipartResponse();
    const refetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refetch.response);
    const { rerender } = await renderTable();
    load.sendPart(
      makeInitialPart({ root: "project", indexes: [1, 4], nodes: COST_ROWS })
    );
    await settle();

    await rerender({ timeRange: OTHER_TIME_RANGE });
    refetch.sendPart(
      makeInitialPart({ root: "node", indexes: [1, 4], nodes: COST_ROWS })
    );
    refetch.sendPart({
      ...makeScoresPart({ indexes: [1, 4], meanScore: 0.75 }),
      // The cost part is still to come.
      hasNext: true,
    });
    await settle();
    expect(readCostCells()["evaluator-4"]).toEqual(["loading", "loading"]);

    load.sendPart(makeFailedCostPart({ indexes: [1, 4] }));
    load.end();
    await settle();

    expect(readCostCells()["evaluator-4"]).toEqual(["loading", "loading"]);
  });
});
