import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import type { MockEnvironment } from "relay-test-utils";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import type * as DateTimeModule from "@phoenix/components/datetime";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import type { SpansTable_spans$key } from "@phoenix/pages/project/__generated__/SpansTable_spans.graphql";

installTestMatchMedia();

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRangeSearch: () => "",
}));

/** Stands in for the table: reads its rows' fragment and names its condition. */
vi.mock("@phoenix/pages/project/SpansTable", async () => {
  const { useFragment } = await import("react-relay");
  const { default: spansTableFragment } =
    await import("@phoenix/pages/project/__generated__/SpansTable_spans.graphql");
  return {
    SpansTable: ({
      project,
      seed,
    }: {
      project: SpansTable_spans$key;
      seed: { condition: string };
    }) => {
      useFragment(spansTableFragment, project);
      return <p>{`rows for ${seed.condition}`}</p>;
    },
  };
});

import {
  CompareSelectionProvider,
  useCompareSelection,
} from "../ProjectEvaluatorCompareSelectionContext";
import { ProjectEvaluatorCompareTargets } from "../ProjectEvaluatorCompareTargets";
import type { ProjectEvaluatorCompareTargetsTestQuery } from "./__generated__/ProjectEvaluatorCompareTargetsTestQuery.graphql";

const PROJECT_ID = "UHJvamVjdDox";
const TIME_RANGE = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-07-02T00:00:00.000Z"),
};

function CompareTargets() {
  const data = useLazyLoadQuery<ProjectEvaluatorCompareTargetsTestQuery>(
    graphql`
      query ProjectEvaluatorCompareTargetsTestQuery @relay_test_operation {
        project: node(id: "UHJvamVjdDox") {
          ... on Project {
            evaluatorComparison(
              evaluatorAId: "ProjectEvaluator:1"
              evaluatorBId: "ProjectEvaluator:2"
              timeRange: {
                start: "2026-07-01T00:00:00.000Z"
                end: "2026-07-02T00:00:00.000Z"
              }
            ) {
              ...ProjectEvaluatorCompareTargets_comparison
            }
          }
        }
        evaluatorA: node(id: "ProjectEvaluator:1") {
          ... on ProjectEvaluator {
            ...ProjectEvaluatorCompareTargets_evaluator
          }
        }
        evaluatorB: node(id: "ProjectEvaluator:2") {
          ... on ProjectEvaluator {
            ...ProjectEvaluatorCompareTargets_evaluator
          }
        }
      }
    `,
    {}
  );
  const comparison = data.project?.evaluatorComparison;
  if (
    comparison == null ||
    data.evaluatorA == null ||
    data.evaluatorB == null
  ) {
    throw new Error("the comparison and both evaluators are required");
  }
  return (
    <ProjectEvaluatorCompareTargets
      projectId={PROJECT_ID}
      comparisonRef={comparison}
      evaluatorARef={data.evaluatorA}
      evaluatorBRef={data.evaluatorB}
      timeRange={TIME_RANGE}
    />
  );
}

function SelectCellButton() {
  const { setSelection } = useCompareSelection();
  return (
    <button
      onClick={() => setSelection({ kind: "matrix", a: "pass", b: "fail" })}
    >
      select cell
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;
let environment: MockEnvironment;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  environment = createMockEnvironment();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function resolveMostRecentOperation() {
  await act(async () =>
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: (context) =>
          context.path?.[0] === "project"
            ? { __typename: "Project", id: PROJECT_ID }
            : { __typename: "ProjectEvaluator" },
        Project: () => ({ id: PROJECT_ID }),
        ProjectEvaluatorComparison: () => ({ evaluationTarget: "SPAN" }),
        EvaluatorComparisonSummary: (_, generateId) => ({
          annotationName: `evaluator-${generateId()}`,
          labels: ["pass", "fail"],
          threshold: null,
        }),
      })
    )
  );
}

function readTable() {
  return container.querySelector("p")?.textContent ?? null;
}

describe("ProjectEvaluatorCompareTargets", () => {
  it("keeps the current rows on screen while the next selection's rows load", async () => {
    await act(async () =>
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <AgentProvider>
              <RelayEnvironmentProvider environment={environment}>
                <MemoryRouter
                  initialEntries={[
                    `/projects/${PROJECT_ID}/evaluators/compare`,
                  ]}
                >
                  <Routes>
                    <Route
                      path="/projects/:projectId/evaluators/compare"
                      element={
                        <CompareSelectionProvider>
                          <SelectCellButton />
                          <Suspense fallback="loading">
                            <CompareTargets />
                          </Suspense>
                        </CompareSelectionProvider>
                      }
                    />
                  </Routes>
                </MemoryRouter>
              </RelayEnvironmentProvider>
            </AgentProvider>
          </PreferencesProvider>
        </ThemeProvider>
      )
    );
    await resolveMostRecentOperation();
    await resolveMostRecentOperation();
    const firstRows = readTable();
    expect(firstRows).toMatch(/^rows for /);

    const shownTables: Array<string | null> = [];
    const observer = new MutationObserver(() => shownTables.push(readTable()));
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const selectCellButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "select cell"
    );
    await act(async () => selectCellButton?.click());
    observer.disconnect();

    expect(environment.mock.getAllOperations()).toHaveLength(1);
    expect(new Set(shownTables)).toEqual(new Set([firstRows]));
    expect(readTable()).toBe(firstRows);
  });
});
