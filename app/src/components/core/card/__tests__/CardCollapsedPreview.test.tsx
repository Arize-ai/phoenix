import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CardCollapsedPreview } from "../CardCollapsedPreview";

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactNode) {
  act(() => {
    root.render(element);
  });
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

describe("CardCollapsedPreview", () => {
  it("renders the excerpt", () => {
    render(
      <CardCollapsedPreview>
        Hi, I am your friendly assistant
      </CardCollapsedPreview>
    );

    const preview = container.querySelector(".card__collapsed-preview");
    expect(preview?.textContent).toBe("Hi, I am your friendly assistant");
  });

  // it renders inside the collapse button on a card without `interactiveTitle`,
  // where it would otherwise become that button's accessible name
  it("hides the excerpt from assistive tech", () => {
    render(<CardCollapsedPreview>an excerpt</CardCollapsedPreview>);

    expect(
      container
        .querySelector(".card__collapsed-preview")
        ?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  // the callers hand it whatever their preview helper returned, which is
  // `undefined` when the card holds nothing worth excerpting
  it("renders nothing when there is no excerpt", () => {
    render(<CardCollapsedPreview>{undefined}</CardCollapsedPreview>);
    expect(container.querySelector(".card__collapsed-preview")).toBeNull();

    render(<CardCollapsedPreview>{""}</CardCollapsedPreview>);
    expect(container.querySelector(".card__collapsed-preview")).toBeNull();
  });
});
