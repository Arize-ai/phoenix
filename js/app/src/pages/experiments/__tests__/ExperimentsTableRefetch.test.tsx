import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { DatasetProvider } from "@phoenix/contexts/DatasetContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ExperimentsPage } from "../ExperimentsPage";

installTestMatchMedia();

const SEARCH_DEBOUNCE_MS = 200;

describe("ExperimentsTable refetches", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: ReturnType<typeof createMockEnvironment>;

  beforeEach(() => {
    environment = createMockEnvironment();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function resolvePendingOperations() {
    await act(async () => {
      for (const operation of environment.mock.getAllOperations()) {
        environment.mock.resolve(
          operation,
          MockPayloadGenerator.generate(operation, {
            Dataset: () => ({ id: "dataset-1", experimentCount: 1 }),
            ExperimentConnection: () => ({ edges: [] }),
          })
        );
      }
    });
  }

  async function renderPage() {
    const router = createMemoryRouter(
      [
        {
          path: "/datasets/:datasetId/experiments",
          element: (
            <DatasetProvider
              datasetId="dataset-1"
              datasetName="dataset"
              latestVersion={null}
            >
              <Suspense fallback="loading">
                <ExperimentsPage />
              </Suspense>
            </DatasetProvider>
          ),
        },
      ],
      { initialEntries: ["/datasets/dataset-1/experiments"] }
    );
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <RouterProvider router={router} />
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    await resolvePendingOperations();
  }

  /** Finds an input by its label or aria-label anywhere in the document. */
  function getInput(name: string): HTMLInputElement {
    const label = Array.from(document.querySelectorAll("label")).find(
      (element) => element.textContent === name
    );
    const input = label?.htmlFor
      ? document.getElementById(label.htmlFor)
      : document.querySelector(
          `[aria-label="${name}"] input, input[aria-label="${name}"]`
        );
    expect(input).toBeInstanceOf(HTMLInputElement);
    return input as HTMLInputElement;
  }

  async function typeInto(name: string, text: string) {
    const input = getInput(name);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function clickButton(name: string) {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) =>
        element.getAttribute("aria-label") === name ||
        element.textContent === name
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
    });
  }

  function getLastTableRefetchVariables() {
    const refetches = environment.mock
      .getAllOperations()
      .filter(
        (operation) =>
          operation.request.node.params.name === "ExperimentsTableQuery"
      );
    expect(refetches.length).toBeGreaterThan(0);
    return refetches[refetches.length - 1].request.variables;
  }

  it("keeps an added metadata filter when the search text changes", async () => {
    await renderPage();

    await clickButton("Filter experiments by metadata");
    await typeInto("Key", "model");
    await typeInto("Value", "gpt-5");
    await clickButton("Add filter");
    await resolvePendingOperations();

    await typeInto("Search experiments", "cold");
    await act(
      () => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS))
    );

    expect(getLastTableRefetchVariables()).toMatchObject({
      filterCondition: "cold",
      metadataFilters: [{ path: ["model"], value: "gpt-5" }],
    });
  });
});
