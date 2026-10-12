import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import { AnnotationInputExplanation } from "../AnnotationInputExplanation";
import type { Annotation } from "../types";

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

  const renderExplanation = (
    currentAnnotation: Annotation | null = annotation
  ) => {
    act(() => {
      root.render(
        <>
          <AnnotationInputExplanation
            annotation={currentAnnotation ?? undefined}
          />
          <button type="button" aria-label="Following control">
            Following control
          </button>
        </>
      );
    });
    return {
      explanationButton: container.querySelector<HTMLButtonElement>(
        "button.annotation-input-explanation"
      ),
      followingButton: container.querySelector<HTMLButtonElement>(
        'button[aria-label="Following control"]'
      ),
    };
  };

  it("includes an enabled explanation button in sequential keyboard navigation", async () => {
    const user = userEvent.setup();
    const { explanationButton } = renderExplanation();

    await act(async () => user.tab());

    expect(document.activeElement).toBe(explanationButton);
  });

  it("skips a disabled explanation button during sequential keyboard navigation", async () => {
    const user = userEvent.setup();
    const { explanationButton, followingButton } = renderExplanation(null);

    expect(explanationButton?.disabled).toBe(true);

    await act(async () => user.tab());

    expect(document.activeElement).toBe(followingButton);
  });

  it("opens the explanation popover with Enter and focuses its input", async () => {
    const user = userEvent.setup();
    const { explanationButton } = renderExplanation();

    await act(async () => user.tab());
    expect(document.activeElement).toBe(explanationButton);

    await act(async () => user.keyboard("{Enter}"));

    const input = document.querySelector<HTMLInputElement>(
      'input[name="helpfulness.explanation"]'
    );
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
