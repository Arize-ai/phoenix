import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { createMockEnvironment } from "relay-test-utils";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { EditProjectEvaluatorPage } from "../ProjectEvaluatorSlideoverRoutes";

installTestMatchMedia();

const detailsOutletContext = {
  projectEvaluator: {
    id: "project-evaluator-1",
    name: "correctness",
    evaluator: { kind: "LLM" },
  },
};

describe("EditProjectEvaluatorPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("opens the slideover while an LLM evaluator loads, without sandbox data", async () => {
    const environment = createMockEnvironment();
    await act(async () =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <MemoryRouter
              initialEntries={["/evaluators/project-evaluator-1/edit"]}
            >
              <Routes>
                <Route
                  path="/evaluators/:projectEvaluatorId"
                  element={<Outlet context={detailsOutletContext} />}
                >
                  <Route
                    path="edit"
                    element={
                      <Suspense fallback={null}>
                        <EditProjectEvaluatorPage />
                      </Suspense>
                    }
                  />
                </Route>
              </Routes>
            </MemoryRouter>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      )
    );

    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Edit LLM evaluator “correctness”"]'
      )
    ).not.toBeNull();
    const [operation] = environment.mock.getAllOperations();
    expect(operation?.request.node.params.name).toBe(
      "EditProjectEvaluatorSlideoverQuery"
    );
    expect(operation?.request.variables).toMatchObject({
      includeSandboxes: false,
    });
  });
});
