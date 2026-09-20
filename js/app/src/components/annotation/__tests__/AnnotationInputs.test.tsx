import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import { CategoricalAnnotationInput } from "../CategoricalAnnotationInput";
import { ContinuousAnnotationInput } from "../ContinuousAnnotationInput";
import type {
  Annotation,
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
} from "../types";

const annotation: Annotation = {
  id: "annotation-1",
  name: "helpfulness",
  label: "helpful",
  score: 0.8,
  explanation: null,
};

const categoricalConfig: AnnotationConfigCategorical = {
  id: "categorical-config",
  name: "helpfulness",
  annotationType: "CATEGORICAL",
  description: "How helpful was the response?",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "helpful", score: 1 },
    { label: "unhelpful", score: 0 },
  ],
};

const continuousConfig: AnnotationConfigContinuous = {
  id: "continuous-config",
  name: "helpfulness",
  annotationType: "CONTINUOUS",
  description: "How helpful was the response?",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

describe("annotation input focus order", () => {
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

  it("focuses a categorical value before its explanation button", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <CategoricalAnnotationInput
          annotation={annotation}
          annotationConfig={categoricalConfig}
        />
      );
    });
    const valueButton = container.querySelector<HTMLButtonElement>(
      "button:not(.annotation-input-explanation)"
    );
    const explanationButton = container.querySelector<HTMLButtonElement>(
      "button.annotation-input-explanation"
    );

    await act(async () => user.tab());
    expect(document.activeElement).toBe(valueButton);

    await act(async () => user.tab());
    expect(document.activeElement).toBe(explanationButton);
  });

  it("renders categorical values in optimization order", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <CategoricalAnnotationInput
          annotation={annotation}
          annotationConfig={{
            ...categoricalConfig,
            values: [
              { label: "negative", score: 0 },
              { label: "positive", score: 1 },
              { label: "neutral", score: 0.5 },
            ],
          }}
        />
      );
    });
    const valueButton = container.querySelector<HTMLButtonElement>(
      "button:not(.annotation-input-explanation)"
    );
    expect(valueButton).not.toBeNull();

    await act(async () => user.click(valueButton!));

    expect(
      Array.from(document.querySelectorAll('[role="option"]')).map(
        (option) => option.textContent
      )
    ).toEqual(["positive", "neutral", "negative"]);
  });

  it("focuses a continuous score before its explanation button", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <ContinuousAnnotationInput
          annotation={annotation}
          annotationConfig={continuousConfig}
        />
      );
    });
    const scoreInput = container.querySelector<HTMLInputElement>(
      "input.react-aria-Input"
    );
    const explanationButton = container.querySelector<HTMLButtonElement>(
      "button.annotation-input-explanation"
    );

    await act(async () => user.tab());
    expect(document.activeElement).toBe(scoreInput);

    await act(async () => user.tab());
    expect(document.activeElement).toBe(explanationButton);
  });
});
