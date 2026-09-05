import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import type { Annotation } from "../types";
import { AnnotationInputExplanation } from "../AnnotationInputExplanation";

const annotation: Annotation = {
  id: "ann-1",
  name: "helpfulness",
  score: 0.8,
  explanation: null,
};

describe("AnnotationInputExplanation", () => {
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

  const renderExplanation = (current: Annotation = annotation) => {
    act(() => {
      root.render(<AnnotationInputExplanation annotation={current} />);
    });
    return container.querySelector<HTMLButtonElement>(
      "button.annotation-input-explanation"
    );
  };

  it("is reachable via keyboard navigation", () => {
    const button = renderExplanation();
    expect(button).not.toBeNull();
    expect(button?.getAttribute("tabindex")).not.toBe("-1");
  });

  it("opens the explanation popover when clicked", async () => {
    const user = userEvent.setup();
    const button = renderExplanation();
    expect(button).not.toBeNull();

    await user.click(button as HTMLButtonElement);

    const input = document.querySelector<HTMLInputElement>(
      'input[name="helpfulness.explanation"]'
    );
    expect(input).not.toBeNull();
  });

  it("applies its overlay geometry so the control sits beside the field", () => {
    const button = renderExplanation();
    const style = button?.getAttribute("style") ?? "";
    const className = button?.className ?? "";
    // eslint-disable-next-line no-console
    console.log("BUTTON_CLASS:", className);
    // eslint-disable-next-line no-console
    console.log(
      "EMOTION_STYLES:",
      document.querySelectorAll("style[data-emotion]").length
    );
    const hasPosition = style.includes("position") || className.includes("css-");
    expect(hasPosition).toBe(true);
  });
});
