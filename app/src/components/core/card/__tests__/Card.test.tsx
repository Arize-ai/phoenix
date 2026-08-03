import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Card } from "../Card";

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
    throw new Error(`no element matched ${selector}`);
  }
  return element;
}

function isCollapsed(): boolean {
  return query(".card").getAttribute("data-collapsed") === "true";
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

describe("Card", () => {
  describe("with an interactive title", () => {
    // the collapse toggle is only the arrow, so the header itself has to carry
    // the click for the rest of the row to stay a target
    function renderCard() {
      render(
        <Card
          title="Attributes"
          collapsible
          interactiveTitle
          collapseButtonLabel="Attributes"
          titleExtra={<button type="button">help</button>}
        >
          body
        </Card>
      );
    }

    it("collapses when the header is clicked beside the toggle", () => {
      renderCard();
      expect(isCollapsed()).toBe(false);

      click(query(".card__heading"));
      expect(isCollapsed()).toBe(true);

      click(query(".card__heading"));
      expect(isCollapsed()).toBe(false);
    });

    it("collapses when the toggle itself is clicked", () => {
      renderCard();

      click(query(".card__collapsible-button"));
      expect(isCollapsed()).toBe(true);
    });

    it("leaves the card alone when a control in the title is clicked", () => {
      renderCard();

      click(query(".card__title button"));
      expect(isCollapsed()).toBe(false);
    });
  });

  describe("with a collapsed preview", () => {
    function renderCard() {
      render(
        <Card
          title="user"
          collapsible
          collapsedPreview="Hi, I am your friendly assistant"
        >
          body
        </Card>
      );
    }

    it("shows the preview only once the card is collapsed", () => {
      renderCard();
      expect(container.querySelector(".card__collapsed-preview")).toBeNull();

      click(query(".card__collapsible-button"));
      expect(query(".card__collapsed-preview").textContent).toBe(
        "Hi, I am your friendly assistant"
      );

      click(query(".card__collapsible-button"));
      expect(container.querySelector(".card__collapsed-preview")).toBeNull();
    });

    it("leaves a card that cannot collapse without a preview", () => {
      render(
        <Card title="user" collapsedPreview="Hi, I am your friendly assistant">
          body
        </Card>
      );

      expect(container.querySelector(".card__collapsed-preview")).toBeNull();
    });
  });

  it("collapses when the header is clicked without an interactive title", () => {
    render(
      <Card title="Attributes" collapsible>
        body
      </Card>
    );

    click(query(".card__collapsible-button"));
    expect(isCollapsed()).toBe(true);
  });
});
