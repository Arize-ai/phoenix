import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnnotationExplanationSummary } from "@phoenix/components/annotation/AnnotationExplanationSummary";

describe("AnnotationExplanationSummary", () => {
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

  it("shows the explanation for one annotation", () => {
    act(() => {
      root.render(
        <AnnotationExplanationSummary
          annotations={[{ name: "quality", explanation: "Strong evidence" }]}
        />
      );
    });

    expect(container.textContent).toBe("Strong evidence");
  });

  it.each([
    {
      name: "one explained and one unexplained annotation",
      annotations: [
        { name: "quality", explanation: "Strong evidence" },
        { name: "quality" },
      ],
    },
    {
      name: "two explained annotations",
      annotations: [
        { name: "quality", explanation: "Strong evidence" },
        { name: "quality", explanation: "Relevant evidence" },
      ],
    },
  ])("shows mixed explanations for $name", ({ annotations }) => {
    act(() => {
      root.render(<AnnotationExplanationSummary annotations={annotations} />);
    });

    expect(container.textContent).toBe("mixed explanations");
  });

  it("renders nothing when no explanation exists", () => {
    act(() => {
      root.render(
        <AnnotationExplanationSummary
          annotations={[{ name: "quality" }, { name: "quality" }]}
        />
      );
    });

    expect(container.textContent).toBe("");
  });
});
