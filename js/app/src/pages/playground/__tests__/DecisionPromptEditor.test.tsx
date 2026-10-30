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
    state: createDecisionStateDraft({ text: "First {{ticket}}" }),
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
          state: createDecisionStateDraft({ text: "Typed {{ticket}}" }),
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
            state: createDecisionStateDraft({ text: "Second {{ticket}}" }),
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

function renderEditor(store: ReturnType<typeof createPlaygroundStore>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () =>
    act(async () =>
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
  const cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  const button = (label: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === label
    );
  return { container, render, cleanup, button };
}

it("switches between Text and JSON, keeping each and seeding an empty JSON with holes", async () => {
  const draft = {
    ...createDecisionDraft(),
    state: createDecisionStateDraft({ text: "Ticket {{ticket}} from {{who}}" }),
  };
  const store = createPlaygroundStore({
    modelConfigByProvider: {},
    instances: [
      { ...createDecisionTaskInstance(), id: 1, decisionPrompt: draft },
    ],
  });
  const readState = () =>
    selectPlaygroundInstanceDecisionPrompt(1)(store.getState())?.state;
  const { container, render, cleanup } = renderEditor(store);
  const modeButton = (label: string) =>
    Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[aria-label="State mode"] button'
      )
    ).find((candidate) => candidate.textContent === label);
  try {
    await render();
    expect(
      Array.from(
        container.querySelectorAll('[aria-label="State mode"] button')
      ).map((candidate) => candidate.textContent)
    ).toEqual(["Text", "JSON"]);
    await act(async () => modeButton("JSON")?.click());
    expect(readState()).toEqual({
      mode: "json",
      text: "Ticket {{ticket}} from {{who}}",
      json: JSON.stringify({ ticket: "{{ticket}}", who: "{{who}}" }, null, 2),
    });
    await act(async () => modeButton("Text")?.click());
    expect(readState()?.mode).toBe("text");
    expect(readState()?.text).toBe("Ticket {{ticket}} from {{who}}");
  } finally {
    await cleanup();
  }
});
