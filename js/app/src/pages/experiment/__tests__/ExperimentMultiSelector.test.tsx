import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadQuery, RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import type { ExperimentComparePageQueriesMultiSelectorQuery as QueryType } from "../__generated__/ExperimentComparePageQueriesMultiSelectorQuery.graphql";
import QueryNode from "../__generated__/ExperimentComparePageQueriesMultiSelectorQuery.graphql";
import { ExperimentMultiSelector } from "../ExperimentMultiSelector";

const DATASET_ID = "dataset-1";
const BASE_ID = "experiment-1";
const OTHER_ID = "experiment-2";

function buildExperiment(id: string, sequenceNumber: number) {
  return {
    id,
    name: `Experiment ${sequenceNumber}`,
    sequenceNumber,
    isBaseline: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function resolveQuery(environment: ReturnType<typeof createMockEnvironment>) {
  environment.mock.resolveMostRecentOperation((operation) =>
    MockPayloadGenerator.generate(operation, {
      Dataset: () => ({
        id: DATASET_ID,
        name: "Dataset",
        experiments: {
          edges: [
            { node: buildExperiment(BASE_ID, 1) },
            { node: buildExperiment(OTHER_ID, 2) },
          ],
        },
      }),
      Experiment: () => buildExperiment(BASE_ID, 1),
    })
  );
}

describe("ExperimentMultiSelector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    user = userEvent.setup();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderSelector(onChange: (...args: unknown[]) => void) {
    const environment = createMockEnvironment();
    const queryRef = loadQuery<QueryType>(environment, QueryNode, {
      datasetId: DATASET_ID,
      hasBaseExperiment: true,
      baseExperimentId: BASE_ID,
    });
    await act(async () => {
      resolveQuery(environment);
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <Suspense fallback={null}>
              <ExperimentMultiSelector
                selectedBaseExperimentId={BASE_ID}
                selectedCompareExperimentIds={[]}
                onChange={onChange}
                queryRef={queryRef}
              />
            </Suspense>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  async function openBasePicker() {
    const findTrigger = () =>
      Array.from(container.querySelectorAll<HTMLElement>("button")).find(
        (button) => button.textContent?.includes("Experiment 1")
      );
    await vi.waitFor(() => expect(findTrigger()).toBeDefined());
    await act(() => user.click(findTrigger()!));
  }

  function getOption(text: string) {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((option) => option.textContent?.includes(text));
  }

  it("does not throw or clear the base when the selected base experiment is clicked again", async () => {
    const onChange = vi.fn();
    const uncaught: unknown[] = [];
    const onWindowError = (event: ErrorEvent) => {
      uncaught.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onWindowError);

    await renderSelector(onChange);
    await openBasePicker();
    const selectedOption = getOption("Experiment 1");
    expect(selectedOption?.getAttribute("aria-selected")).toBe("true");

    await act(() => user.click(selectedOption!));
    window.removeEventListener("error", onWindowError);

    expect(uncaught).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    expect(getOption("Experiment 1")?.getAttribute("aria-selected")).toBe(
      "true"
    );
  });
});
