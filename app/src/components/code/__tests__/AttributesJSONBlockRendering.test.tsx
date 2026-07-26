import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { AttributesJSONBlock } from "@phoenix/components/code/AttributesJSONBlock";
import {
  CollapsibleContentProvider,
  useCollapsibleContent,
} from "@phoenix/components/core/contexts/CollapsibleContentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

function renderAttributes(attributes: string) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AttributesJSONBlock attributes={attributes} />
      </ThemeProvider>
    );
  });
}

function CollapseAllButton() {
  const { collapseAll, expandAll, isCollapsed } = useCollapsibleContent();
  return (
    <button onClick={isCollapsed ? expandAll : collapseAll}>
      {isCollapsed ? "Expand all" : "Collapse all"}
    </button>
  );
}

describe("AttributesJSONBlock", () => {
  it("automatically renders an error alert with malformed attributes", () => {
    renderAttributes('{"valid": true, "truncated":');

    const alert = container.querySelector('[data-variant="danger"]');
    expect(alert?.textContent).toContain("Malformed attributes payload");
    expect(alert?.textContent).toContain("The raw value is shown below");
    expect(container.textContent).toContain('{"valid": true, "truncated":');
  });

  it("does not render an error alert with valid attributes", () => {
    renderAttributes('{"valid": true}');

    expect(container.querySelector('[data-variant="danger"]')).toBeNull();
  });

  it("folds the JSON tree when its collapse-all scope is collapsed", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <CollapsibleContentProvider>
            <CollapseAllButton />
            <AttributesJSONBlock
              attributes={JSON.stringify({
                input: { nested: { value: "input" } },
                output: { nested: { value: "output" } },
              })}
            />
          </CollapsibleContentProvider>
        </ThemeProvider>
      );
    });

    expect(container.querySelector(".cm-foldPlaceholder")).toBeNull();

    const collapseAllButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "Collapse all");
    expect(collapseAllButton).toBeDefined();
    act(() => collapseAllButton?.click());

    expect(container.querySelector(".cm-foldPlaceholder")).not.toBeNull();

    const expandAllButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "Expand all");
    expect(expandAllButton).toBeDefined();
    act(() => expandAllButton?.click());

    expect(container.querySelector(".cm-foldPlaceholder")).toBeNull();
  });
});
