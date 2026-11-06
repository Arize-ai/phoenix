import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusIndicator } from "../../statusIndicator";
import { MarkerTrigger } from "../MarkerTrigger";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: React.ReactNode) {
  act(() => {
    root.render(element);
  });
}

function pressTrigger() {
  const trigger = container.querySelector(".marker-trigger");
  if (trigger === null) {
    throw new Error("no marker trigger rendered");
  }
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  };
  act(() => {
    trigger.dispatchEvent(new PointerEvent("pointerdown", init));
    trigger.dispatchEvent(new MouseEvent("mousedown", init));
    trigger.dispatchEvent(new PointerEvent("pointerup", init));
    trigger.dispatchEvent(new MouseEvent("mouseup", init));
    trigger.dispatchEvent(new MouseEvent("click", { ...init, detail: 1 }));
  });
}

function CurrentPath() {
  return <output>{useLocation().pathname}</output>;
}

function inClickableRow(trigger: React.ReactNode, onRowClick: () => void) {
  return (
    <table>
      <tbody>
        <tr onClick={onRowClick} onPointerDown={onRowClick}>
          <td>{trigger}</td>
        </tr>
      </tbody>
    </table>
  );
}

describe("MarkerTrigger", () => {
  it("runs its action without activating a clickable row around it", () => {
    const onPress = vi.fn();
    const onRowClick = vi.fn();
    render(
      inClickableRow(
        <MarkerTrigger aria-label="Show only errors" onPress={onPress}>
          <StatusIndicator category="failed" label="Error" />
        </MarkerTrigger>,
        onRowClick
      )
    );
    pressTrigger();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("toggles its explanation without activating a clickable row around it", () => {
    const onRowClick = vi.fn();
    render(
      inClickableRow(
        <MarkerTrigger explanation="Experiment is currently in progress">
          <StatusIndicator category="running" label="Running" />
        </MarkerTrigger>,
        onRowClick
      )
    );
    pressTrigger();
    expect(document.body.textContent).toContain(
      "Experiment is currently in progress"
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("links to its destination without activating a clickable row around it", () => {
    const onRowClick = vi.fn();
    render(
      <MemoryRouter>
        {inClickableRow(
          <MarkerTrigger
            aria-label="Error: view experiment details"
            href="/datasets/1/experiments/2"
          >
            <StatusIndicator category="failed" label="Error" isLabelHidden />
          </MarkerTrigger>,
          onRowClick
        )}
        <CurrentPath />
      </MemoryRouter>
    );
    const link = container.querySelector("a.marker-trigger");
    expect(link?.getAttribute("href")).toBe("/datasets/1/experiments/2");
    pressTrigger();
    expect(container.querySelector("output")?.textContent).toBe(
      "/datasets/1/experiments/2"
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("drops a hidden-label marker's native title only when it shows an explanation", () => {
    render(
      <>
        <MarkerTrigger explanation="Experiment is currently in progress">
          <StatusIndicator category="running" label="Running" isLabelHidden />
        </MarkerTrigger>
        <MarkerTrigger aria-label="Show only errors">
          <StatusIndicator category="failed" label="Error" isLabelHidden />
        </MarkerTrigger>
      </>
    );
    const [explained, actionOnly] = Array.from(
      container.querySelectorAll(".status-indicator")
    );
    expect(explained.getAttribute("title")).toBeNull();
    expect(explained.getAttribute("aria-label")).toBe("Running");
    expect(actionOnly.getAttribute("title")).toBe("Error");
  });
});
