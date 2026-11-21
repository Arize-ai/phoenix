import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { ProjectPageContent } from "../ProjectPage";

installTestMatchMedia();

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

describe("ProjectPageContent", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("requests the spans table's first page while the page query is in flight", async () => {
    const environment = createMockEnvironment();
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <MemoryRouter initialEntries={["/projects/project-1/spans"]}>
                <Routes>
                  <Route
                    path="/projects/:projectId/*"
                    element={
                      <Suspense fallback={null}>
                        <ProjectPageContent
                          projectId="project-1"
                          timeRangeISOStrings={TIME_RANGE}
                        />
                      </Suspense>
                    }
                  />
                </Routes>
              </MemoryRouter>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });

    const pendingOperationNames = environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
    expect(pendingOperationNames).toEqual(
      expect.arrayContaining([
        "ProjectPageQuery",
        "ProjectPageQueriesSpansQuery",
      ])
    );
  });
});
