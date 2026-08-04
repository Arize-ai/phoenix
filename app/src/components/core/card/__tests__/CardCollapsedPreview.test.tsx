import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Card } from "../Card";
import { CardCollapsedPreview } from "../CardCollapsedPreview";

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactNode) {
  act(() => {
    root.render(element);
  });
}

function previews(): Element[] {
  return [...container.querySelectorAll(".card__collapsed-preview")];
}

function previewIn(card: Element): Element | null {
  return card.querySelector(".card__collapsed-preview");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const EXCERPT = "Hi, I am your friendly assistant";

// `children` takes no default — a default would swallow the explicit
// `undefined` the empty-excerpt case is there to exercise
function CardWithPreview({
  title = "user",
  defaultOpen,
  children,
}: {
  title?: string;
  defaultOpen?: boolean;
  children?: string;
}) {
  return (
    <Card
      title={title}
      collapsible
      defaultOpen={defaultOpen}
      headerContent={<CardCollapsedPreview>{children}</CardCollapsedPreview>}
    >
      body
    </Card>
  );
}

describe("CardCollapsedPreview", () => {
  it("shows the excerpt only while its card is collapsed", () => {
    render(<CardWithPreview>{EXCERPT}</CardWithPreview>);
    expect(previews()).toHaveLength(0);

    act(() => {
      container
        .querySelector(".card__collapsible-button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(previews()[0]?.textContent).toBe(EXCERPT);
  });

  // cards nest — message cards render inside an input card's body — and each
  // preview has to answer to the card it belongs to, not to any card above it
  it("answers to its own card rather than an enclosing one", () => {
    render(
      <Card title="Input" collapsible>
        <CardWithPreview title="assistant" defaultOpen={false}>
          {EXCERPT}
        </CardWithPreview>
      </Card>
    );

    const [outer, inner] = [...container.querySelectorAll(".card")];
    expect(outer.getAttribute("data-collapsed")).toBe("false");
    expect(inner.getAttribute("data-collapsed")).toBe("true");
    // the open outer card must not suppress the closed inner card's excerpt
    expect(previewIn(inner)).not.toBeNull();
  });

  // it renders inside the collapse button on a card without `interactiveTitle`,
  // where it would otherwise become that button's accessible name
  it("hides the excerpt from assistive tech", () => {
    render(<CardWithPreview defaultOpen={false}>{EXCERPT}</CardWithPreview>);

    expect(previews()[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  // the callers hand it whatever their preview helper returned, which is
  // `undefined` when the card holds nothing worth excerpting
  it("renders nothing when there is no excerpt", () => {
    render(<CardWithPreview defaultOpen={false}>{undefined}</CardWithPreview>);
    expect(previews()).toHaveLength(0);

    render(<CardWithPreview defaultOpen={false}>{""}</CardWithPreview>);
    expect(previews()).toHaveLength(0);
  });

  // header content written for a collapsed card should stay out of the way
  // rather than throw when it is rendered somewhere without one
  it("renders nothing outside a card", () => {
    render(<CardCollapsedPreview>an excerpt</CardCollapsedPreview>);
    expect(previews()).toHaveLength(0);
  });
});
