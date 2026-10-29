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

it("switches between Template and Inputs, keeping each, and says what the inputs send", async () => {
  const draft = {
    ...createDecisionDraft(),
    state: createDecisionStateDraft({
      mode: "inputs",
      inputNames: ["state"],
    }),
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
    // The drawn state, without the (hidden) Enter key hint.
    const inputsEditor = () =>
      container
        .querySelector('[aria-label="State inputs"]')
        ?.textContent?.replace("↵", "");
    // Only two modes: the JSON, Value and Object modes are gone.
    expect(
      Array.from(
        container.querySelectorAll('[aria-label="State mode"] button')
      ).map((button) => button.textContent)
    ).toEqual(["Template", "Inputs"]);
    // One input is drawn as an object keyed by its name, with the value typed
    // in the Inputs panel beside it as it is sent.
    expect(inputsEditor()).toBe('{"state": state// {"ticket":"Refund"}}');
    expect(
      container.querySelector('[aria-label="Remove state"]')
    ).not.toBeNull();

    // An empty template starts from the inputs.
    await act(async () => modeButton("Template")?.click());
    expect(readState()).toEqual({
      mode: "template",
      template: "state: {{state}}",
      inputNames: ["state"],
    });
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Decision state"]'
      )?.value
    ).toBe("state: {{state}}");

    // Back to Inputs keeps the names; several are sent as one object too.
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
    // An input with no typed value has no preview.
    expect(inputsEditor()).toBe(
      '{"state": state,// {"ticket":"Refund"}"plan": plan}'
    );

    // Removing an input back to one keeps the object.
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Remove plan"]')
        ?.click()
    );
    expect(readState()).toMatchObject({ inputNames: ["state"] });
    expect(inputsEditor()).toBe('{"state": state// {"ticket":"Refund"}}');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
