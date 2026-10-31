import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IconButton } from "../button";
import { PageHeader } from "../PageHeader";

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

function renderHeader(onPress: () => void) {
  act(() => {
    root.render(
      <PageHeader
        title="support-agent"
        labelAction={
          <IconButton size="S" aria-label="Edit labels" onPress={onPress}>
            +
          </IconButton>
        }
      />
    );
  });
}

describe("PageHeader", () => {
  it("presses the label action when its empty text is clicked", () => {
    const onPress = vi.fn();
    renderHeader(onPress);
    const text = [...container.querySelectorAll("span")].find(
      (element) => element.textContent === "No labels"
    );
    expect(text).toBeDefined();
    act(() => {
      text!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("presses the label action once when the action itself is clicked", () => {
    const onPress = vi.fn();
    renderHeader(onPress);
    const button = container.querySelector("button")!;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
