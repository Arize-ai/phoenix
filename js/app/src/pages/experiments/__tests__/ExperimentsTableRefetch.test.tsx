import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { DatasetProvider } from "@phoenix/contexts/DatasetContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ExperimentsPage } from "../ExperimentsPage";

// The CodeMirror field doesn't run under jsdom, so this stand-in settles every
// value as valid, the way the real field does once the server accepts it.
vi.mock("../ExperimentFilterConditionField", async () => {
  const React = await import("react");
  return {
    ExperimentFilterConditionField: ({
      value,
      onValidCondition,
    }: {
      value: string;
      onValidCondition: (args: {
        condition: string;
        isInitialSettlement: boolean;
      }) => void;
    }) => {
      const isInitialSettlement = React.useRef(true);
      React.useEffect(() => {
        onValidCondition({
          condition: value,
          isInitialSettlement: isInitialSettlement.current,
        });
        isInitialSettlement.current = false;
        // Settle once per value, like the real field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [value]);
      return React.createElement("div", null, value);
    },
  };
});

installTestMatchMedia();

const SEARCH_DEBOUNCE_MS = 200;
const METADATA_CONDITION = 'metadata["model"] == "gpt-5"';

describe("ExperimentsTable refetches", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: ReturnType<typeof createMockEnvironment>;
  let resolvedOperations: OperationDescriptor[];

  beforeEach(() => {
    environment = createMockEnvironment();
    resolvedOperations = [];
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
        resolvedOperations.push(operation);
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

  async function renderPage(search = "") {
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
      { initialEntries: [`/datasets/dataset-1/experiments${search}`] }
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
    return router;
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

  async function addMetadataFilter() {
    await clickButton("Filter experiments by metadata");
    await typeInto("Key", "model");
    await typeInto("Value", "gpt-5");
    await clickButton("Add filter");
  }

  async function search(text: string) {
    await typeInto("Search experiments", text);
    await act(
      () => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS))
    );
  }

  it("keeps a filter condition from the Metadata form when the search text changes", async () => {
    await renderPage();

    await addMetadataFilter();
    await resolvePendingOperations();
    await search("cold");

    expect(getLastTableRefetchVariables()).toMatchObject({
      filterCondition: "cold",
      experimentFilterCondition: METADATA_CONDITION,
    });
  });

  it("keeps the search text when the filter condition changes", async () => {
    await renderPage();

    await search("cold");
    await resolvePendingOperations();
    await addMetadataFilter();

    expect(getLastTableRefetchVariables()).toMatchObject({
      filterCondition: "cold",
      experimentFilterCondition: METADATA_CONDITION,
    });
  });

  it("fetches with the URL's filter condition and writes an applied one back", async () => {
    const router = await renderPage(
      `?experimentFilterCondition=${encodeURIComponent("repetitions > 1")}`
    );
    const pageQuery = resolvedOperations.find(
      (operation) =>
        operation.request.node.params.name === "ExperimentsPageQuery"
    );
    expect(pageQuery?.request.variables).toMatchObject({
      experimentFilterCondition: "repetitions > 1",
    });

    await addMetadataFilter();

    const appliedCondition = `(repetitions > 1) and (${METADATA_CONDITION})`;
    expect(getLastTableRefetchVariables()).toMatchObject({
      experimentFilterCondition: appliedCondition,
    });
    expect(
      new URLSearchParams(router.state.location.search).get(
        "experimentFilterCondition"
      )
    ).toBe(appliedCondition);
  });

  it("says No results when a search matches nothing", async () => {
    await renderPage();
    expect(container.textContent).toContain("No experiments");

    await search("cold");
    await resolvePendingOperations();

    expect(container.textContent).toContain("No results");
  });
});
