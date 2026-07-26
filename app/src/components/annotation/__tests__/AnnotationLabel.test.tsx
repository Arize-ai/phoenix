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
