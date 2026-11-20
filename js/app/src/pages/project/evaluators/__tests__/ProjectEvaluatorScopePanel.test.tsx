import { act, use } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { ThemeProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { DEFAULT_DECISION_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

installTestMatchMedia();

const SCOPE: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "parent_id is None",
  samplingRate: 1,
  evaluationDelaySeconds: 0,
  tracingEnabled: true,
};

/** Span names, newest first, as the spans listing returns them for a page size. */
function listSpanNames(first: number): string[] {
  const listedSpanNames = Array.from(
    { length: 10 },
    (_, index) => `span-${index}`
  );
  if (first <= listedSpanNames.length) {
    return listedSpanNames;
  }
  // Spans that arrived after the first page was listed sort above it.
  const arrivedSpanNames = Array.from(
    { length: 5 },
    (_, index) => `arrived-${index}`
  );
  const olderSpanNames = Array.from(
    { length: 10 },
    (_, index) => `older-${index}`
  );
  return [...arrivedSpanNames, ...listedSpanNames, ...olderSpanNames].slice(
    0,
    first
  );
}

/**
 * Answers every query the panel has sent and not yet seen answered: the span
 * listing with listSpanNames for the requested page size, always with more to
 * load.
 */
async function resolvePendingPanelQueries(
  environment: ReturnType<typeof createMockEnvironment>
) {
  for (const operation of environment.mock.getAllOperations()) {
    const spanNames = listSpanNames(
      Number(operation.request.variables.first ?? 0)
    );
    let spanIndex = 0;
    await act(async () =>
      environment.mock.resolve(
        operation,
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "Project" }),
          // Both queries read the same project, so it keeps one record id.
          ID: ({ path }, generateId) =>
            path?.join(".") === "project.id"
              ? "project-1"
              : `<mock-id-${generateId()}>`,
          SpanConnection: () => ({
            edges: spanNames.map(() => ({})),
            pageInfo: { hasNextPage: true },
          }),
          Span: () => {
            const name = spanNames[spanIndex++];
            return { id: `node-${name}`, name, spanId: name };
          },
          // Product queries carry no scalar type info, so numbers and JSON
          // reach the String resolver; key them by schema field name.
          String: ({ name }) => {
            switch (name) {
              case "totalCount":
              case "latencyMs":
                return 1;
              case "evaluationContext":
                return {};
              case "spanKind":
                return "llm";
              case "startTime":
                return "2026-11-10T20:00:00.000Z";
              default:
                return undefined;
            }
          },
        })
      )
    );
  }
}

function listRecordTableRowNames(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="project-evaluator-record-table"] .record-table__title'
    ),
    (title) => title.textContent ?? ""
  );
}

function countPreviewQueries(
  environment: ReturnType<typeof createMockEnvironment>
) {
  return environment.mock
    .getAllOperations()
    .filter(({ request }) =>
      request.node.params.name.startsWith("ProjectEvaluatorScopePanel")
    ).length;
}

describe("ProjectEvaluatorScopePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T20:12:55.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("sends its preview queries once while the form beside it is still loading", async () => {
    const environment = createMockEnvironment();
    let resolveFormQuery: () => void = () => {};
    const formQuery = new Promise<void>((resolve) => {
      resolveFormQuery = resolve;
    });
    function LoadingFormSection() {
      use(formQuery);
      return null;
    }
    await act(async () =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light">
            <ProjectEvaluatorSlideover isOpen title="Create evaluator">
              {() => (
                <>
                  <LoadingFormSection />
                  <ProjectEvaluatorScopePanel
                    projectId="project-1"
                    scope={SCOPE}
                    decision={{ blocker: "No decision" }}
                  />
                </>
              )}
            </ProjectEvaluatorSlideover>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      )
    );
    expect(countPreviewQueries(environment)).toBe(2);

    vi.setSystemTime(new Date("2026-11-10T20:13:05.000Z"));
    await act(async () => resolveFormQuery());

    expect(countPreviewQueries(environment)).toBe(2);
  });

  /** Renders the panel with the providers its test bench reads. */
  async function renderPanelWithBench({
    environment,
    scope,
  }: {
    environment: ReturnType<typeof createMockEnvironment>;
    scope: ProjectEvaluatorScope;
  }) {
    await act(async () =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light">
            <ProjectEvaluatorSlideover isOpen title="Create evaluator">
              {() => (
                <CredentialsProvider>
                  <EvaluatorStoreProvider
                    initialState={DEFAULT_DECISION_EVALUATOR_STORE_VALUES}
                  >
                    <EvaluatorInputVariablesProvider variables={[]}>
                      <ProjectEvaluatorScopePanel
                        projectId="project-1"
                        scope={scope}
                        decision={{ blocker: "No decision" }}
                      />
                    </EvaluatorInputVariablesProvider>
                  </EvaluatorStoreProvider>
                </CredentialsProvider>
              )}
            </ProjectEvaluatorSlideover>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      )
    );
  }

  async function clickLoadMore() {
    const loadMoreButton = Array.from(
      document.body.querySelectorAll("button")
    ).find((button) => button.textContent === "Load More");
    expect(loadMoreButton).toBeDefined();
    await act(async () => loadMoreButton?.click());
  }

  it("keeps the listed records in place and adds the next page below them on load more", async () => {
    const environment = createMockEnvironment();
    await renderPanelWithBench({ environment, scope: SCOPE });
    await resolvePendingPanelQueries(environment);
    const firstPageNames = listSpanNames(10);
    expect(listRecordTableRowNames(document.body)).toEqual(firstPageNames);

    await clickLoadMore();
    await resolvePendingPanelQueries(environment);

    const rowNames = listRecordTableRowNames(document.body);
    expect(rowNames.slice(0, firstPageNames.length)).toEqual(firstPageNames);
    expect(
      rowNames
        .slice(firstPageNames.length)
        .filter((name) => name.startsWith("older-"))
    ).toEqual(["older-0", "older-1", "older-2", "older-3", "older-4"]);
  });
});
