import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RetrievalMetricLabel } from "../RetrievalMetricLabel";

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

describe("RetrievalMetricLabel", () => {
  it("adapts named and ranked numeric metrics to annotation labels", () => {
    act(() => {
      root.render(
        <RetrievalMetricLabel
          name="retrieval quality"
          metric="ndcg"
          k={5}
          score={0.94}
        />
      );
    });

    const label = container.querySelector(
      '[aria-label="Annotation: retrieval quality ndcg@5"]'
    );

    expect(label).not.toBeNull();
    expect(label?.querySelector('[data-value-kind="score"]')?.textContent).toBe(
      "0.94"
    );
    expect(label?.querySelector("[data-shape][data-size]")).toBeNull();
  });

  it("preserves missing numeric and boolean hit values", () => {
    act(() => {
      root.render(
        <>
          <RetrievalMetricLabel metric="precision" score={null} />
          <RetrievalMetricLabel metric="hit" score={1} />
          <RetrievalMetricLabel metric="hit" score={0} />
        </>
      );
    });

    expect(
      container.querySelector('[aria-label="Annotation: precision"]')
        ?.textContent
    ).toBe("precision--");
    expect(
      container.querySelector('[aria-label="Annotation: hit"]')?.textContent
    ).toBe("hittrue");
    expect(
      container.querySelectorAll('[aria-label="Annotation: hit"]')[1]
        ?.textContent
    ).toBe("hitfalse");
  });
});
