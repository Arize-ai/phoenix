import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Card } from "@phoenix/components";

import {
  SpanInfoCardsProvider,
  useSpanInfoCardProps,
} from "../SpanInfoCardsContext";
import { SpanInfoCardsToggle } from "../SpanInfoCardsToggle";

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactNode) {
  act(() => {
    root.render(element);
  });
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function query(selector: string): Element {
  const element = container.querySelector(selector);
  if (element === null) {
    throw new Error(`No element matched ${selector}`);
  }
  return element;
}

function InputCard({ spanId }: { spanId: string }) {
  const cardProps = useSpanInfoCardProps("input");
  return (
    <Card key={spanId} {...cardProps} title="Input" collapsible>
      <details open>
        <summary>Nested content</summary>
        Body
      </details>
    </Card>
  );
}

function Fixture({ spanId }: { spanId: string }) {
  return (
    <SpanInfoCardsProvider>
      <SpanInfoCardsToggle />
      <InputCard spanId={spanId} />
    </SpanInfoCardsProvider>
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SpanInfoCardsProvider", () => {
  it("preserves controlled card state across spans without changing nested content", () => {
    render(<Fixture spanId="span-a" />);

    click(query('button[aria-label="Collapse all sections"]'));
    expect(query(".card").getAttribute("data-collapsed")).toBe("true");
    expect(query("details").hasAttribute("open")).toBe(true);

    render(<Fixture spanId="span-b" />);
    expect(query(".card").getAttribute("data-collapsed")).toBe("true");
    expect(query("details").hasAttribute("open")).toBe(true);
  });
});
