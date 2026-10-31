import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { AddEvaluatorMenuContents } from "../AddEvaluatorMenu";

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useFragment: () => ({
    builtInEvaluators: [],
    classificationEvaluatorConfigs: [],
  }),
}));

describe("AddEvaluatorMenuContents", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("offers a decision evaluator entry that opens the decision create flow", async () => {
    const handlers = {
      onCreateEvaluator: vi.fn(),
      onCreateCodeEvaluator: vi.fn(),
      onCreateDecisionEvaluator: vi.fn(),
      onSelectBuiltInCodeEvaluator: vi.fn(),
      onSelectBuiltInLLMEvaluator: vi.fn(),
    };
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          {/* The fragment ref is mocked away above. */}
          <AddEvaluatorMenuContents query={{} as never} {...handlers} />
        </ThemeContext.Provider>
      );
    });
    const item = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).find((el) => el.textContent?.includes("Create new decision evaluator"));
    expect(item).toBeDefined();
    await act(async () => (item as HTMLElement).click());
    expect(handlers.onCreateDecisionEvaluator).toHaveBeenCalledOnce();
    expect(handlers.onCreateEvaluator).not.toHaveBeenCalled();
    expect(handlers.onCreateCodeEvaluator).not.toHaveBeenCalled();
  });
});
