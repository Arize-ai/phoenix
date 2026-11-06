import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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
  const init = { bubbles: true, button: 0, pointerId: 1, pointerType: "mouse" };
  act(() => {
    trigger.dispatchEvent(new PointerEvent("pointerdown", init));
    trigger.dispatchEvent(new MouseEvent("mousedown", init));
    trigger.dispatchEvent(new PointerEvent("pointerup", init));
    trigger.dispatchEvent(new MouseEvent("mouseup", init));
    trigger.dispatchEvent(new MouseEvent("click", { ...init, detail: 1 }));
  });
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
});
