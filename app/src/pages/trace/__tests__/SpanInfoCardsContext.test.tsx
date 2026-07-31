import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExpandableContent } from "@phoenix/components/core/content";

import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
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

function InputSection({ spanId }: { spanId: string }) {
  const sectionProps = useSpanInfoCardProps("input");
  return (
    <SpanDetailsDisclosureSection
      key={spanId}
      sectionId={`input-${spanId}`}
      title="Input"
      titleExtra={<button type="button">Help</button>}
      extra={<button type="button">Copy</button>}
      {...sectionProps}
    >
      <ExpandableContent height="sm" isOverflowing>
        Nested content
      </ExpandableContent>
    </SpanDetailsDisclosureSection>
  );
}

function Fixture({ spanId }: { spanId: string }) {
  return (
    <SpanInfoCardsProvider>
      <SpanInfoCardsToggle />
      <InputSection spanId={spanId} />
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
  it("toggles from the full title region without consuming header controls", () => {
    render(<Fixture spanId="span-a" />);

    click(query(".span-details-section-heading__title"));
    expect(query("button[aria-controls]").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(
      query(".span-details-section-heading__header").getAttribute(
        "data-collapsed"
      )
    ).toBe("true");

    click(query("button[aria-controls]"));
    click(
      query(".span-details-section-heading__title button:not([aria-controls])")
    );
    click(query(".span-details-section-heading__extra button"));
    expect(query("button[aria-controls]").getAttribute("aria-expanded")).toBe(
      "true"
    );
  });

  it("preserves controlled section state across spans without expanding overflow affordances", () => {
    render(<Fixture spanId="span-a" />);

    click(query('button[aria-label="Collapse all sections"]'));
    expect(query("button[aria-controls]").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(
      query('button[aria-label="Show more"]').getAttribute("aria-expanded")
    ).toBe("false");

    render(<Fixture spanId="span-b" />);
    expect(query("button[aria-controls]").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(
      query('button[aria-label="Show more"]').getAttribute("aria-expanded")
    ).toBe("false");

    click(query('button[aria-label="Expand all sections"]'));
    expect(query("button[aria-controls]").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(
      query('button[aria-label="Show more"]').getAttribute("aria-expanded")
    ).toBe("false");
  });
});
