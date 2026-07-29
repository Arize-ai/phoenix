import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Icon, Icons } from "@phoenix/components";

import { ExpandCollapseAllButton } from "../ExpandCollapseAllButton";

let container: HTMLDivElement;
let root: Root;

function renderButton({
  isCollapsed,
  onCollapsedChange = () => undefined,
}: {
  isCollapsed: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
}) {
  const expectedIcon = isCollapsed ? (
    <Icons.RowExpand />
  ) : (
    <Icons.RowCollapse />
  );
  act(() => {
    root.render(
      <>
        <ExpandCollapseAllButton
          contentLabel="traces"
          isCollapsed={isCollapsed}
          onCollapsedChange={onCollapsedChange}
        />
        <div data-testid="expected-icon">
          <Icon svg={expectedIcon} />
        </div>
      </>
    );
  });
}

function getIconPath(selector: string) {
  const path = container.querySelector(`${selector} svg path`);
  if (path === null) {
    throw new Error(`No icon path matched ${selector}`);
  }
  return path.getAttribute("d");
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

describe("ExpandCollapseAllButton", () => {
  it.each([
    { isCollapsed: true, actionLabel: "Expand all" },
    { isCollapsed: false, actionLabel: "Collapse all" },
  ])(
    "shows the icon for the $actionLabel action",
    ({ isCollapsed, actionLabel }) => {
      renderButton({ isCollapsed });

      const button = container.querySelector(
        `button[aria-label="${actionLabel}"]`
      );
      expect(button).not.toBeNull();
      expect(getIconPath("button")).toBe(
        getIconPath('[data-testid="expected-icon"]')
      );
    }
  );

  it("toggles the collapsed state", () => {
    const onCollapsedChange = vi.fn();
    renderButton({ isCollapsed: true, onCollapsedChange });

    act(() => {
      container
        .querySelector('button[aria-label="Expand all"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
