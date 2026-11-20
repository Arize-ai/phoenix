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

const LISTED_SPAN_NAMES = Array.from(
  { length: 10 },
  (_, index) => `span-${index}`
);
const ARRIVED_SPAN_NAMES = Array.from(
  { length: 5 },
  (_, index) => `arrived-${index}`
);
const OLDER_SPAN_NAMES = Array.from(
  { length: 5 },
  (_, index) => `older-${index}`
);

function findPendingOperation({
  environment,
  operationName,
}: {
  environment: ReturnType<typeof createMockEnvironment>;
  operationName: string;
}) {
  const operation = environment.mock
    .getAllOperations()
    .find(({ request }) => request.node.params.name === operationName);
  if (operation == null) {
    throw new Error(`No pending ${operationName}`);
  }
  return operation;
}

/**
 * Answers the pending operation of that name. Both the count and the listing
 * read node(id: "project-1"), so the project keeps one record id.
 */
async function resolvePanelQuery({
  environment,
  operationName,
  spanNames = [],
}: {
  environment: ReturnType<typeof createMockEnvironment>;
  operationName: string;
  spanNames?: string[];
}) {
  const operation = findPendingOperation({ environment, operationName });
  await act(async () =>
    environment.mock.resolve(
      operation,
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "Project" }),
        ID: ({ path }, generateId) =>
          path?.join(".") === "project.id"
            ? "project-1"
            : `<mock-id-${generateId()}>`,
        SpanConnection: () => ({
          edges: spanNames.map((name) => ({
            span: { id: `node-${name}`, name },
          })),
          pageInfo: { hasNextPage: true },
        }),
      })
    )
  );
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
    await resolvePanelQuery({
      environment,
      operationName: "ProjectEvaluatorScopePanelCountQuery",
    });
    await resolvePanelQuery({
      environment,
      operationName: "ProjectEvaluatorScopePanelSpansQuery",
      spanNames: LISTED_SPAN_NAMES,
    });
    expect(listRecordTableRowNames(document.body)).toEqual(LISTED_SPAN_NAMES);

    await clickLoadMore();
    // Spans that arrived after the first page was listed sort above it.
    await resolvePanelQuery({
      environment,
      operationName: "ProjectEvaluatorScopePanelSpansQuery",
      spanNames: [
        ...ARRIVED_SPAN_NAMES,
        ...LISTED_SPAN_NAMES,
        ...OLDER_SPAN_NAMES,
      ],
    });

    const rowNames = listRecordTableRowNames(document.body);
    expect(rowNames.slice(0, LISTED_SPAN_NAMES.length)).toEqual(
      LISTED_SPAN_NAMES
    );
    expect(
      rowNames
        .slice(LISTED_SPAN_NAMES.length)
        .filter((name) => name.startsWith("older-"))
    ).toEqual(OLDER_SPAN_NAMES);
  });
});
