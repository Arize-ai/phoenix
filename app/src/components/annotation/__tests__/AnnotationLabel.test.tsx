import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";

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

describe("AnnotationLabel", () => {
  it("renders compact score wrappers with and without semantic color", () => {
    act(() => {
      root.render(
        <>
          <AnnotationLabel
            annotation={{ name: "graded", score: 1 }}
            optimizationValue={1}
          />
          <AnnotationLabel annotation={{ name: "ungraded", score: 1 }} />
        </>
      );
    });

    const gradedScore = container.querySelector(
      '[aria-label="Annotation: graded"] [data-value-kind="score"]'
    );
    const ungradedScore = container.querySelector(
      '[aria-label="Annotation: ungraded"] [data-value-kind="score"]'
    );

    expect(gradedScore?.getAttribute("data-appearance")).toBe("compact");
    expect(gradedScore?.getAttribute("data-direction")).toBe("positive");
    expect(ungradedScore?.getAttribute("data-appearance")).toBe("compact");
    expect(ungradedScore?.getAttribute("data-direction")).toBeNull();
    expect(gradedScore?.tagName).toBe(ungradedScore?.tagName);
  });

  it("renders ghost annotations without a value", () => {
    act(() => {
      root.render(
        <AnnotationLabel
          annotation={{ name: "quality", label: "good", score: 1 }}
          annotationDisplayPreference="score-and-label"
          variant="ghost"
        >
          mixed
        </AnnotationLabel>
      );
    });

    expect(container.textContent).toBe("quality");
  });
});
