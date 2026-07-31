import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from "../../disclosure";
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

  it("collapses when the header is clicked without an interactive title", () => {
    render(
      <Card title="Attributes" collapsible>
        body
      </Card>
    );

    click(query(".card__collapsible-button"));
    expect(isCollapsed()).toBe(true);
  });

  it("shares compact header padding with nested disclosure rows", () => {
    container.style.setProperty("--global-card-compact-header-padding", "4px");
    container.style.setProperty(
      "--global-disclosure-trigger-padding",
      "8px 16px"
    );
    render(
      <Card title="Assistant" variant="compact">
        <Disclosure>
          <DisclosureTrigger arrowPosition="start">Tool Call</DisclosureTrigger>
          <DisclosurePanel>body</DisclosurePanel>
        </Disclosure>
      </Card>
    );

    expect(
      getComputedStyle(query(".card"))
        .getPropertyValue("--disclosure-trigger-padding")
        .trim()
    ).toBe("var(--global-card-compact-header-padding)");
    expect(
      getComputedStyle(query('[slot="trigger"]'))
        .getPropertyValue("--disclosure-trigger-padding")
        .trim()
    ).toBe("var(--global-card-compact-header-padding)");
  });
});
