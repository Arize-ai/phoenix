import { act } from "react";
import { createRoot } from "react-dom/client";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import {
  createDecisionTaskInstance,
  createPlaygroundStore,
} from "@phoenix/store/playground/playgroundStore";
import { selectPlaygroundInstanceDecisionPrompt } from "@phoenix/store/playground/selectors";

import { DecisionPromptEditor } from "../DecisionPromptEditor";
import {
  createDecisionDraft,
  createDecisionStateDraft,
} from "../decisionUtils";

vi.mock("@phoenix/components/templateEditor", () => ({
  TemplateEditor: ({ defaultValue }: { defaultValue: string }) => (
    <input aria-label="Decision state" defaultValue={defaultValue} />
  ),
  TemplateEditorWrap: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../DecisionQuestionEditor", () => ({
  DecisionQuestionEditor: () => null,
}));

installTestStorage();

it("reloads an uncontrolled state editor on load, while typing keeps it mounted", async () => {
  const draft = {
    ...createDecisionDraft(),
    state: createDecisionStateDraft({ template: "First {{ticket}}" }),
  };
  const store = createPlaygroundStore({
    modelConfigByProvider: {},
    instances: [
      { ...createDecisionTaskInstance(), id: 1, decisionPrompt: draft },
    ],
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            themeMode: "light",
            systemTheme: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <PlaygroundContext.Provider value={store}>
            <DecisionPromptEditor playgroundInstanceId={1} />
          </PlaygroundContext.Provider>
        </ThemeContext.Provider>
      )
    );
    const editor = container.querySelector<HTMLInputElement>(
      'input[aria-label="Decision state"]'
    );
    expect(editor?.value).toBe("First {{ticket}}");
    await act(async () =>
      store.getState().updateDecisionPrompt({
        instanceId: 1,
        request: {
          ...draft,
          state: createDecisionStateDraft({ template: "Typed {{ticket}}" }),
        },
      })
    );
    expect(container.querySelector('input[aria-label="Decision state"]')).toBe(
      editor
    );
    await act(async () =>
      store.getState().loadInstance({
        instanceId: 1,
        instance: {
          ...createDecisionTaskInstance(),
          decisionPrompt: {
            ...draft,
            state: createDecisionStateDraft({ template: "Second {{ticket}}" }),
          },
        },
      })
    );
    const loadedEditor = container.querySelector<HTMLInputElement>(
      'input[aria-label="Decision state"]'
    );
    expect(loadedEditor).not.toBe(editor);
    expect(loadedEditor?.value).toBe("Second {{ticket}}");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("switches between Template and Inputs, keeping each, and previews structured input values", async () => {
  const draft = {
    ...createDecisionDraft(),
    state: createDecisionStateDraft({ mode: "inputs", inputNames: ["state"] }),
  };
  const store = createPlaygroundStore({
    modelConfigByProvider: {},
    instances: [
      { ...createDecisionTaskInstance(), id: 1, decisionPrompt: draft },
    ],
    input: { variablesValueCache: { state: '{"ticket":"Refund"}' } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const readState = () =>
    selectPlaygroundInstanceDecisionPrompt(1)(store.getState())?.state;
  const modeButton = (label: string) =>
    Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[aria-label="State mode"] button'
      )
    ).find((button) => button.textContent === label);
  try {
    await act(async () =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            themeMode: "light",
            systemTheme: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <PlaygroundContext.Provider value={store}>
            <DecisionPromptEditor playgroundInstanceId={1} />
          </PlaygroundContext.Provider>
        </ThemeContext.Provider>
      )
    );
    const preview = () =>
      container.querySelector('[aria-label="Decision state preview"]')
        ?.textContent;
    // Only two modes: the JSON, Value and Object modes are gone.
    expect(
      Array.from(
        container.querySelectorAll('[aria-label="State mode"] button')
      ).map((button) => button.textContent)
    ).toEqual(["Template", "Inputs"]);
    // One input is sent as its value, and JSON typed for it as that JSON.
    expect(preview()).toBe(JSON.stringify({ ticket: "Refund" }));
    expect(
      container.querySelector('[aria-label="Remove state"]')
    ).not.toBeNull();

    // An empty template starts from the inputs.
    await act(async () => modeButton("Template")?.click());
    expect(readState()).toEqual({
      mode: "template",
      template: "{{state}}",
      inputNames: ["state"],
    });
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Decision state"]'
      )?.value
    ).toBe("{{state}}");

    // Back to Inputs keeps the names; several are sent as one object.
    await act(async () => modeButton("Inputs")?.click());
    expect(readState()?.inputNames).toEqual(["state"]);
    await act(async () =>
      store.getState().updateDecisionPrompt({
        instanceId: 1,
        request: {
          ...draft,
          state: createDecisionStateDraft({
            mode: "inputs",
            inputNames: ["state", "plan"],
          }),
        },
      })
    );
    await act(async () => store.getState().setVariableValue("plan", "pro"));
    expect(preview()).toBe(
      JSON.stringify({ state: { ticket: "Refund" }, plan: "pro" })
    );
    await act(async () => store.setState({ datasetId: "dataset" }));
    expect(container.textContent).toContain("State shape");
    expect(preview()).toBe('{ "state": <state>, "plan": <plan> }');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
