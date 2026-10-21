import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  makeModelNameFilterCondition,
  ModelNameTableCell,
} from "../ModelNameTableCell";

describe("makeModelNameFilterCondition", () => {
  it("builds an llm.model_name equality condition", () => {
    expect(makeModelNameFilterCondition("gpt-4o")).toBe(
      'llm.model_name == "gpt-4o"'
    );
  });

  it("escapes quotes and backslashes in the model name", () => {
    expect(makeModelNameFilterCondition('my"model\\v1')).toBe(
      'llm.model_name == "my\\"model\\\\v1"'
    );
  });
});

describe("ModelNameTableCell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    // ThemeProvider reads the preferred color scheme, which jsdom lacks
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders a placeholder when the span has no model", () => {
    act(() =>
      root.render(
        <ModelNameTableCell
          modelName={null}
          onFilterConditionPressed={vi.fn()}
        />
      )
    );
    expect(container.textContent).toBe("--");
  });

  it("appends a model filter when pressed without triggering the row click", () => {
    const onFilterConditionPressed = vi.fn();
    const onRowClick = vi.fn();
    act(() =>
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <div onClick={onRowClick}>
            <ModelNameTableCell
              modelName="gpt-4o"
              onFilterConditionPressed={onFilterConditionPressed}
            />
          </div>
        </ThemeProvider>
      )
    );
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("gpt-4o");
    act(() => button?.click());
    expect(onFilterConditionPressed).toHaveBeenCalledWith(
      'llm.model_name == "gpt-4o"'
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
