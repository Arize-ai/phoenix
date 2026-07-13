import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { createPlaygroundStore } from "@phoenix/store";

import { PlaygroundOutputHeader } from "../PlaygroundOutputHeader";

describe("PlaygroundOutputHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows completed run errors after the experiment finishes", () => {
    const playgroundStore = createPlaygroundStore({
      modelConfigByProvider: {},
    });
    const instance = playgroundStore.getState().instances[0];
    expect(instance).toBeDefined();
    if (instance == null) {
      return;
    }
    playgroundStore.setState({
      instances: [
        {
          ...instance,
          activeRunId: null,
          experimentRunProgress: {
            totalRuns: 10,
            runsCompleted: 7,
            runsFailed: 3,
            totalEvals: 0,
            evalsCompleted: 0,
            evalsFailed: 0,
          },
        },
      ],
    });

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PlaygroundContext.Provider value={playgroundStore}>
            <PlaygroundOutputHeader instanceId={instance.id} index={0} />
          </PlaygroundContext.Provider>
        </ThemeProvider>
      );
    });

    const errorCounter = container.querySelector(
      '.counter[data-variant="danger"]'
    );
    expect(errorCounter?.textContent).toBe("3");
  });

  it("does not show an error counter when every run succeeds", () => {
    const playgroundStore = createPlaygroundStore({
      modelConfigByProvider: {},
    });
    const instance = playgroundStore.getState().instances[0];
    expect(instance).toBeDefined();
    if (instance == null) {
      return;
    }

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PlaygroundContext.Provider value={playgroundStore}>
            <PlaygroundOutputHeader instanceId={instance.id} index={0} />
          </PlaygroundContext.Provider>
        </ThemeProvider>
      );
    });

    expect(container.querySelector(".counter")).toBeNull();
  });
});
