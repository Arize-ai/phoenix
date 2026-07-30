import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackActionToolbar } from "@phoenix/components/feedback/FeedbackActionToolbar";

describe("FeedbackActionToolbar", () => {
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

  it("renders the provided quick annotation action before feedback actions", () => {
    act(() => {
      root.render(
        <FeedbackActionToolbar
          annotationAction={<button aria-label="Add annotation">+</button>}
          selectedFeedback={null}
          onFeedback={vi.fn()}
        />
      );
    });

    expect(
      Array.from(container.querySelectorAll("button"), (button) =>
        button.getAttribute("aria-label")
      )
    ).toEqual(["Add annotation", "Thumbs up", "Thumbs down"]);
    expect(container.querySelector('[aria-label="Annotate"]')).toBeNull();
  });
});
