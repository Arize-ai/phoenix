import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DetailPanelAnnotationButton } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import { OverflowRow } from "@phoenix/components/core/utility/OverflowRow";

let container: HTMLDivElement;
let root: Root;
let originalClientWidth: PropertyDescriptor | undefined;
let originalOffsetHeight: PropertyDescriptor | undefined;
let originalOffsetLeft: PropertyDescriptor | undefined;
let originalOffsetTop: PropertyDescriptor | undefined;
let originalOffsetWidth: PropertyDescriptor | undefined;
let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

function getItemIndex(element: HTMLElement) {
  const parent = element.parentElement;
  if (!parent) {
    return 0;
  }
  return Array.from(parent.children)
    .filter((child) => !child.classList.contains("overflow-row__badge-slot"))
    .indexOf(element);
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  originalClientWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth"
  );
  originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight"
  );
  originalOffsetLeft = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetLeft"
  );
  originalOffsetTop = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetTop"
  );
  originalOffsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth"
  );
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: {
      configurable: true,
      get() {
        return this.classList.contains("overflow-row") ? 130 : 60;
      },
    },
    offsetHeight: {
      configurable: true,
      get() {
        return this.classList.contains("overflow-row__badge-slot") ? 0 : 20;
      },
    },
    offsetLeft: {
      configurable: true,
      get() {
        return getItemIndex(this as HTMLElement) * 60;
      },
    },
    offsetTop: {
      configurable: true,
      get() {
        return 0;
      },
    },
    offsetWidth: {
      configurable: true,
      get() {
        return this.classList.contains("overflow-row__badge-slot") ? 0 : 50;
      },
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      bottom: 20,
      height: 20,
      left: 0,
      right: 130,
      top: 0,
      width: 130,
      x: 0,
      y: 0,
      toJSON() {},
    };
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.querySelectorAll(".react-aria-Popover").forEach((popover) => {
    popover.remove();
  });
  const properties = [
    ["clientWidth", originalClientWidth],
    ["offsetHeight", originalOffsetHeight],
    ["offsetLeft", originalOffsetLeft],
    ["offsetTop", originalOffsetTop],
    ["offsetWidth", originalOffsetWidth],
  ] as const;
  for (const [property, descriptor] of properties) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, property, descriptor);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
        property
      ];
    }
  }
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe("OverflowRow", () => {
  it("shows annotation overflow as a vertical list with a named project action", () => {
    act(() => {
      root.render(
        <OverflowRow popoverLayout="vertical">
          <button type="button">quality</button>
          <button type="button">relevance</button>
          <DetailPanelAnnotationButton
            menuKind="annotation-configs"
            targetKind="span"
          >
            <div>Annotation configurations</div>
          </DetailPanelAnnotationButton>
        </OverflowRow>
      );
    });

    const overflowButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show 1 more"]'
    );
    expect(overflowButton).not.toBeNull();

    act(() => overflowButton?.click());

    const projectAnnotationsButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Project annotations");
    expect(projectAnnotationsButton).toBeDefined();
    expect(
      projectAnnotationsButton?.closest(".flex")?.getAttribute("style")
    ).toContain("flex-direction: column");
    const footer = projectAnnotationsButton?.closest(".menu-footer");
    expect(footer).not.toBeNull();
    expect(
      footer?.parentElement?.parentElement?.classList.contains(
        "react-aria-Dialog"
      )
    ).toBe(true);
    expect(
      document.querySelectorAll('[aria-label="Add annotation"]')
    ).toHaveLength(1);
  });
});
