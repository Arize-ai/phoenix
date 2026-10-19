import { act } from "react";
import { createRoot } from "react-dom/client";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import {
  createDecisionTaskInstance,
  createPlaygroundStore,
} from "@phoenix/store/playground/playgroundStore";

import { DecisionRequestEditor } from "../DecisionRequestEditor";
import { createDecisionDraft } from "../decisionUtils";

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
  const draft = { ...createDecisionDraft(), state: "First {{ticket}}" };
  const store = createPlaygroundStore({
    modelConfigByProvider: {},
    instances: [
      { ...createDecisionTaskInstance(), id: 1, decisionRequest: draft },
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
            <DecisionRequestEditor playgroundInstanceId={1} />
          </PlaygroundContext.Provider>
        </ThemeContext.Provider>
      )
    );
    const editor = container.querySelector<HTMLInputElement>(
      'input[aria-label="Decision state"]'
    );
    expect(editor?.value).toBe("First {{ticket}}");
    await act(async () =>
      store.getState().updateDecisionRequest({
        instanceId: 1,
        request: { ...draft, state: "Typed {{ticket}}" },
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
          decisionRequest: { ...draft, state: "Second {{ticket}}" },
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
