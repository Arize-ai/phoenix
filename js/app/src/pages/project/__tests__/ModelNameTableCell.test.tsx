import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  makeModelNameFilterCondition,
  ModelNameTableCell,
} from "../ModelNameTableCell";

installTestMatchMedia();

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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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

  function renderCell({
    modelProvider,
    onFilterConditionPressed = vi.fn(),
    onRowClick = vi.fn(),
  }: {
    modelProvider?: string | null;
    onFilterConditionPressed?: (condition: string) => void;
    onRowClick?: () => void;
  }) {
    act(() =>
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <div onClick={onRowClick}>
            <ModelNameTableCell
              modelName="gpt-4o"
              modelProvider={modelProvider}
              onFilterConditionPressed={onFilterConditionPressed}
            />
          </div>
        </ThemeProvider>
      )
    );
    const button = container.querySelector("button");
    if (!button) {
      throw new Error("expected the model name to be pressable");
    }
    return button;
  }

  it("shows the model name as text led by its provider's icon", () => {
    const button = renderCell({ modelProvider: "openai" });
    // A model name is a value of the span, so it is text, not a Tag
    expect(button.classList.contains("tag")).toBe(false);
    expect(container.querySelector(".tag")).toBeNull();
    expect(button.querySelector(".model-name__text")?.textContent).toBe(
      "gpt-4o"
    );
    expect(button.querySelector("svg title")?.textContent).toBe("OpenAI");
    expect(button.getAttribute("aria-label")).toBe(
      "Filter spans by model gpt-4o"
    );
  });

  it("shows no icon when the provider is missing or unknown", () => {
    expect(renderCell({ modelProvider: null }).querySelector("svg")).toBeNull();
    expect(
      renderCell({ modelProvider: "some-unknown-provider" }).querySelector(
        "svg"
      )
    ).toBeNull();
  });

  it("appends a model filter when pressed without triggering the row click", () => {
    const onFilterConditionPressed = vi.fn();
    const onRowClick = vi.fn();
    const button = renderCell({
      modelProvider: "openai",
      onFilterConditionPressed,
      onRowClick,
    });
    act(() => button.click());
    expect(onFilterConditionPressed).toHaveBeenCalledWith(
      'llm.model_name == "gpt-4o"'
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
