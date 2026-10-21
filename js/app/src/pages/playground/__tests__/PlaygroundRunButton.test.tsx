import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { createPlaygroundStore } from "@phoenix/store/playground";

import { createDecisionDraft } from "../decisionUtils";
import { PlaygroundExampleEditingProvider } from "../examplesEditing";
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
      datasetId,
    });
    const chatInstance = store.getState().instances[0];
    store.getState().updateInstance({
      dirty: false,
      instanceId: chatInstance.id,
      patch: {
        llmModel: chatInstance.model,
        task: { type: "decision" },
        decisionRequest: createDecisionDraft(),
        model: {
          ...chatInstance.model,
          modelType: "DECISION",
          provider: "TYPESAFE",
          modelName: "jev-latest",
        },
      },
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
          <MemoryRouter>
            <PlaygroundContext.Provider value={store}>
              <PlaygroundExampleEditingProvider>
                <PlaygroundRunButton />
              </PlaygroundExampleEditingProvider>
            </PlaygroundContext.Provider>
          </MemoryRouter>
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

  it("explains which instance blocks the run when its request is invalid", async () => {
    const { store, runPlaygroundInstances } = mount(null);
    const instance = store.getState().instances[0];
    const request = instance.decisionRequest!;
    act(() =>
      store.getState().updateDecisionRequest({
        instanceId: instance.id,
        request: {
          ...request,
          questions: request.questions.map((question) => ({
            ...question,
            name: "",
          })),
        },
      })
    );
    const button = runButton();
    expect(button?.disabled).toBe(true);
    act(() => button?.click());
    expect(runPlaygroundInstances).not.toHaveBeenCalled();
    const user = userEvent.setup();
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
    );
    await act(async () => user.hover(button!.parentElement!));
    await vi.waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
        "Instance A: Question name: required"
      );
    });
  });

  it("runs over a dataset when each example fills the state", () => {
    const { store, runPlaygroundInstances } = mount("RGF0YXNldDox");
    const instance = store.getState().instances[0];
    act(() =>
      store.getState().updateDecisionRequest({
        instanceId: instance.id,
        request: { ...instance.decisionRequest!, state: "{{ticket}}" },
      })
    );
    const button = runButton();
    expect(button?.disabled).toBe(false);
    act(() => button?.click());
    expect(runPlaygroundInstances).toHaveBeenCalledTimes(1);
  });

  it("refuses a dataset run and explains why when no example can fill the state", async () => {
    const { runPlaygroundInstances } = mount("RGF0YXNldDox");
    const button = runButton();
    expect(button?.disabled).toBe(true);
    act(() => button?.click());
    expect(runPlaygroundInstances).not.toHaveBeenCalled();
    // The reason is a tooltip on a wrap around the disabled button, since a
    // disabled button receives no pointer events of its own.
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    const triggerWrap = button?.parentElement;
    expect(triggerWrap).not.toBeNull();
    const user = userEvent.setup();
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
    );
    await act(async () => user.hover(triggerWrap!));
    await vi.waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
        "Instance A: Over a dataset, the state needs a template variable"
      );
    });
  });
});
