import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { AnnotationScoreText } from "../AnnotationScoreText";

describe("AnnotationScoreText", () => {
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

  const renderScore = (
    props: Omit<ComponentProps<typeof AnnotationScoreText>, "children">
  ) => {
    act(() => {
      root.render(<AnnotationScoreText {...props}>0.80</AnnotationScoreText>);
    });
    const text = container.querySelector<HTMLElement>(".text");
    return {
      direction: text?.dataset.direction,
      strength: text
        ? getComputedStyle(text)
            .getPropertyValue("--annotation-score-strength")
            .trim()
        : null,
      textContent: text?.textContent,
    };
  };

  it("scales the color by the magnitude of the optimization value", () => {
    expect(renderScore({ optimizationValue: 0.6 })).toEqual({
      direction: "positive",
      strength: "60%",
      textContent: "Favorable score: 0.80",
    });
    expect(renderScore({ optimizationValue: -0.25 })).toMatchObject({
      direction: "negative",
      strength: "25%",
    });
  });

  it("marks a score at the pivot as neutral", () => {
    expect(renderScore({ optimizationValue: 0 })).toMatchObject({
      direction: "neutral",
      textContent: "Neutral score: 0.80",
    });
  });

  it("renders a saturated value at full strength", () => {
    expect(renderScore({ optimizationValue: -1 })).toEqual({
      direction: "negative",
      strength: "100%",
      textContent: "Unfavorable score: 0.80",
    });
  });

  it("leaves an undetermined score uncolored", () => {
    expect(renderScore({})).toEqual({
      direction: undefined,
      strength: "",
      textContent: "0.80",
    });
  });
});
