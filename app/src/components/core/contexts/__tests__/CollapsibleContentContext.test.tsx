import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Card } from "@phoenix/components/core/card";
import {
  CollapsibleContentProvider,
  useCollapsibleContent,
} from "@phoenix/components/core/contexts/CollapsibleContentContext";
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";

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

function CollapsibleContentFixture() {
  const { collapseAll, expandAll, isCollapsed } = useCollapsibleContent();
  const [isLateCardVisible, setIsLateCardVisible] = useState(false);

  return (
    <>
      <button onClick={isCollapsed ? expandAll : collapseAll}>
        {isCollapsed ? "Expand all" : "Collapse all"}
      </button>
      <button onClick={() => setIsLateCardVisible(true)}>Show late card</button>
      <Card title="Details card" collapsible>
        <Card title="System card" collapsible>
          Nested card content
        </Card>
      </Card>
      <DisclosureGroup defaultExpandedKeys={["details"]}>
        <Disclosure id="details">
          <DisclosureTrigger>Details disclosure</DisclosureTrigger>
          <DisclosurePanel>Disclosure content</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
      {isLateCardVisible ? (
        <Card title="Late card" collapsible>
          Late content
        </Card>
      ) : null}
    </>
  );
}

function getButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === label
  );
  if (!button) {
    throw new Error(`Could not find button labeled ${label}`);
  }
  return button;
}

describe("CollapsibleContentProvider", () => {
  it("collapses mounted content and content that mounts later", () => {
    act(() => {
      root.render(
        <CollapsibleContentProvider>
          <CollapsibleContentFixture />
        </CollapsibleContentProvider>
      );
    });

    expect(getButton("Details card").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(getButton("System card").getAttribute("aria-expanded")).toBe("true");
    expect(getButton("Details disclosure").getAttribute("aria-expanded")).toBe(
      "true"
    );

    act(() => getButton("Collapse all").click());

    expect(getButton("Details card").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(getButton("System card").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(getButton("Details disclosure").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(getButton("Expand all")).toBeDefined();

    act(() => getButton("Show late card").click());

    expect(getButton("Late card").getAttribute("aria-expanded")).toBe("false");

    act(() => getButton("Details card").click());

    expect(getButton("Details card").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(getButton("System card").getAttribute("aria-expanded")).toBe(
      "false"
    );

    act(() => getButton("Expand all").click());

    expect(getButton("Details card").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(getButton("System card").getAttribute("aria-expanded")).toBe("true");
    expect(getButton("Late card").getAttribute("aria-expanded")).toBe("true");
    expect(getButton("Details disclosure").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(getButton("Collapse all")).toBeDefined();
  });
});
