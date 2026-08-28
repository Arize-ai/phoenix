import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";

import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function TestProjectEvaluatorPaths() {
  const paths = useProjectEvaluatorPaths();
  return (
    <output
      data-gallery={paths.gallery}
      data-gallery-return={paths.galleryReturn}
      data-response-quality-gallery={paths.galleryCategory("RESPONSE_QUALITY")}
      data-template-gallery={paths.galleryTemplate({
        category: "RESPONSE_QUALITY",
        templateName: "Correctness",
      })}
    />
  );
}

describe("useProjectEvaluatorPaths", () => {
  it("separates the default gallery entry and slideover return destinations", () => {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/projects/project-1/evaluators?timeRangeKey=7d&category=AGENTS&template=Hallucination&proof=preserved",
          ]}
        >
          <Routes>
            <Route
              path="/projects/:projectId/:tab"
              element={<TestProjectEvaluatorPaths />}
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const output = container.querySelector("output");
    expect(output?.getAttribute("data-gallery-return")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&category=AGENTS&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&proof=preserved"
    );
    expect(output?.getAttribute("data-response-quality-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&category=RESPONSE_QUALITY&proof=preserved"
    );
    expect(output?.getAttribute("data-template-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&category=RESPONSE_QUALITY&template=Correctness&proof=preserved"
    );
  });
});
