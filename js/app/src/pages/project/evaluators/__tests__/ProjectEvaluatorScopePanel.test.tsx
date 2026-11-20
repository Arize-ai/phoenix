import { act, use } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

installTestMatchMedia();

const SCOPE: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "parent_id is None",
  samplingRate: 1,
  evaluationDelaySeconds: 0,
  tracingEnabled: true,
};

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
});
