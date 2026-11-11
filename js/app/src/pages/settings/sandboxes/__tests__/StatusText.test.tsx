import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusText } from "../utils";

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

function press(element: Element) {
  const init = { bubbles: true, button: 0, pointerId: 1, pointerType: "mouse" };
  act(() => {
    element.dispatchEvent(new PointerEvent("pointerdown", init));
    element.dispatchEvent(new MouseEvent("mousedown", init));
    element.dispatchEvent(new PointerEvent("pointerup", init));
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", { ...init, detail: 1 }));
  });
}

describe("StatusText", () => {
  it("opens credentials from a missing-credentials status", () => {
    const onPress = vi.fn();
    render(
      <StatusText
        status="MISSING_CREDENTIALS"
        detail="Missing E2B_API_KEY."
        configureCredentials={{
          action: "configure E2B credentials",
          onPress,
        }}
      />
    );
    const trigger = container.querySelector(
      '[aria-label="Needs credentials: configure E2B credentials"]'
    );
    expect(trigger).not.toBeNull();
    press(trigger!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("explains a missing-credentials status to a viewer who cannot set them", () => {
    render(
      <StatusText status="MISSING_CREDENTIALS" detail="Missing E2B_API_KEY." />
    );
    const trigger = container.querySelector(".marker-trigger");
    expect(trigger?.hasAttribute("data-explanation")).toBe(true);
  });

  it("keeps explaining other statuses when credentials can be set", () => {
    const onPress = vi.fn();
    render(
      <StatusText
        status="UNAVAILABLE"
        detail="Backend creation failed."
        configureCredentials={{
          action: "configure E2B credentials",
          onPress,
        }}
      />
    );
    const trigger = container.querySelector(".marker-trigger");
    expect(trigger?.hasAttribute("data-explanation")).toBe(true);
    press(trigger!);
    expect(onPress).not.toHaveBeenCalled();
  });
});
