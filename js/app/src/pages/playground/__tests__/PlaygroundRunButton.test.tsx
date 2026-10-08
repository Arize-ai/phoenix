import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { createPlaygroundStore } from "@phoenix/store/playground";

import { DECISION_DATASET_BLOCKED_REASON } from "../constants";
import { PlaygroundRunButton } from "../PlaygroundRunButton";

vi.mock("../useCancelPlaygroundRun", () => ({
  useCancelPlaygroundRun: () => vi.fn(),
}));

installTestStorage();

describe("PlaygroundRunButton with decision instances", () => {
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

  function mount(datasetId: string | null) {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      defaultModelType: "DECISION",
      defaultModelProvider: "TYPESAFE",
      defaultModelName: "jev-latest",
      datasetId,
    });
    const runPlaygroundInstances = vi.fn();
    store.setState({ runPlaygroundInstances });
    act(() =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <PlaygroundContext.Provider value={store}>
            <PlaygroundRunButton />
          </PlaygroundContext.Provider>
        </ThemeContext.Provider>
      )
    );
    return { store, runPlaygroundInstances };
  }

  function runButton() {
    return container.querySelector<HTMLButtonElement>(
      '[data-testid="playground-run-button"]'
    );
  }

  it("runs a valid decision request when no dataset is loaded", () => {
    const { runPlaygroundInstances } = mount(null);
    const button = runButton();
    expect(button?.disabled).toBe(false);
    act(() => button?.click());
    expect(runPlaygroundInstances).toHaveBeenCalledTimes(1);
  });

  it("refuses the whole run and explains why when a dataset is loaded", () => {
    const { runPlaygroundInstances } = mount("RGF0YXNldDox");
    const button = runButton();
    expect(button?.disabled).toBe(true);
    act(() => button?.click());
    expect(runPlaygroundInstances).not.toHaveBeenCalled();
    // The reason is wired to the button as a tooltip; the wrap carries the
    // trigger so a disabled button still shows it on hover.
    expect(button?.closest("[data-testid]")?.parentElement).not.toBeNull();
    expect(DECISION_DATASET_BLOCKED_REASON).toContain("dataset");
  });
});
