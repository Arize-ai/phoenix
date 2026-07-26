import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Card } from "@phoenix/components/core/card";
import {
  CollapsibleContentProvider,
  useCollapsibleContent,
} from "@phoenix/components/core/contexts/CollapsibleContentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { LLMMessage } from "../LLMMessage";

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

function SystemMessageFixture() {
  const { collapseAll, expandAll, isCollapsed } = useCollapsibleContent();

  return (
    <>
      <button onClick={isCollapsed ? expandAll : collapseAll}>
        {isCollapsed ? "Expand all" : "Collapse all"}
      </button>
      <Card title="Input" collapsible>
        <LLMMessage message={{ role: "system", content: "System prompt" }} />
      </Card>
    </>
  );
}

function getCardButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === label
  );
  if (!button) {
    throw new Error(`Could not find card button labeled ${label}`);
  }
  return button;
}

describe("LLMMessage", () => {
  it("collapses a system message nested inside the input card", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <CollapsibleContentProvider>
            <SystemMessageFixture />
          </CollapsibleContentProvider>
        </PreferencesProvider>
      );
    });

    expect(getCardButton("system").getAttribute("aria-expanded")).toBe("true");

    act(() => getCardButton("Collapse all").click());
    act(() => getCardButton("Input").click());

    expect(getCardButton("system").getAttribute("aria-expanded")).toBe("false");

    act(() => getCardButton("Expand all").click());

    expect(getCardButton("system").getAttribute("aria-expanded")).toBe("true");
  });
});
