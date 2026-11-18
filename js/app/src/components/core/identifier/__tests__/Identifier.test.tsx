import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Identifier, type IdentifierProps } from "../Identifier";

vi.mock("copy-to-clipboard", () => ({ default: vi.fn() }));

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
  vi.mocked(copy).mockClear();
});

function render(props: IdentifierProps) {
  act(() => {
    root.render(<Identifier {...props} />);
  });
}

function pressButton(button: Element) {
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  };
  act(() => {
    button.dispatchEvent(new PointerEvent("pointerdown", init));
    button.dispatchEvent(new MouseEvent("mousedown", init));
    button.dispatchEvent(new PointerEvent("pointerup", init));
    button.dispatchEvent(new MouseEvent("mouseup", init));
    button.dispatchEvent(new MouseEvent("click", { ...init, detail: 1 }));
  });
}

const TRACE_ID = "5b8aa5a2d2c872e8321cf37308d69df2";

describe("Identifier", () => {
  it("keeps the last six characters apart so the head truncates first", () => {
    render({ value: TRACE_ID });
    expect(container.querySelector(".identifier__head")?.textContent).toBe(
      TRACE_ID.slice(0, -6)
    );
    expect(container.querySelector(".identifier__tail")?.textContent).toBe(
      "d69df2"
    );
    expect(container.querySelector(".identifier")?.getAttribute("title")).toBe(
      TRACE_ID
    );
  });

  it("shows a short value whole", () => {
    render({ value: "UHJvbXB0OjE" });
    expect(container.querySelector(".identifier__tail")).toBeNull();
    expect(container.textContent).toBe("UHJvbXB0OjE");
  });

  it("renders nothing for an empty value", () => {
    render({ value: "", copyNoun: "trace ID" });
    expect(container.innerHTML).toBe("");
  });

  it("is plain text without a copy noun", () => {
    render({ value: TRACE_ID });
    expect(container.querySelector("button")).toBeNull();
  });

  it("copies the whole value and names the button after the copy noun", () => {
    render({ value: TRACE_ID, copyNoun: "trace ID" });
    const button = container.querySelector("button");
    if (button === null) {
      throw new Error("no copy button rendered");
    }
    expect(button.getAttribute("aria-label")).toBe(`Copy trace ID ${TRACE_ID}`);
    pressButton(button);
    expect(copy).toHaveBeenCalledWith(TRACE_ID);
    expect(button.hasAttribute("data-copied")).toBe(true);
  });
});
