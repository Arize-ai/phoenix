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
      data-list-new-llm={paths.listCreation.newLlm}
      data-list-new-code={paths.listCreation.newCode}
      data-list-copy-llm={paths.listCreation.copyLlm("Evaluator:llm/source")}
      data-list-copy-code={paths.listCreation.copyCode("Evaluator:code/source")}
      data-list-attach-code={paths.listCreation.attachCode(
        "Evaluator:code/source"
      )}
      data-gallery-new-llm={paths.galleryCreation.newLlm}
      data-gallery-new-code={paths.galleryCreation.newCode}
      data-gallery-copy-llm={paths.galleryCreation.copyLlm(
        "Evaluator:llm/source"
      )}
      data-gallery-copy-code={paths.galleryCreation.copyCode(
        "Evaluator:code/source"
      )}
      data-gallery-attach-code={paths.galleryCreation.attachCode(
        "Evaluator:code/source"
      )}
      data-response-quality-gallery={paths.galleryCategory("RESPONSE_QUALITY")}
      data-template-gallery={paths.galleryTemplate({
        category: "RESPONSE_QUALITY",
        templateName: "Correctness",
      })}
    />
  );
}

describe("useProjectEvaluatorPaths", () => {
  it("builds list and gallery destinations while preserving view state", () => {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/projects/project-1/evaluators?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved",
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
    expect(output?.getAttribute("data-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&proof=preserved"
    );
    expect(output?.getAttribute("data-list-new-llm")).toBe(
      "/projects/project-1/evaluators/new/llm?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-list-new-code")).toBe(
      "/projects/project-1/evaluators/new/code?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-list-copy-llm")).toBe(
      "/projects/project-1/evaluators/new/copy/Evaluator%3Allm%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-list-copy-code")).toBe(
      "/projects/project-1/evaluators/new/copy-code/Evaluator%3Acode%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-list-attach-code")).toBe(
      "/projects/project-1/evaluators/new/attach/Evaluator%3Acode%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery-new-llm")).toBe(
      "/projects/project-1/evaluator-gallery/new/llm?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery-new-code")).toBe(
      "/projects/project-1/evaluator-gallery/new/code?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery-copy-llm")).toBe(
      "/projects/project-1/evaluator-gallery/new/copy/Evaluator%3Allm%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery-copy-code")).toBe(
      "/projects/project-1/evaluator-gallery/new/copy-code/Evaluator%3Acode%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-gallery-attach-code")).toBe(
      "/projects/project-1/evaluator-gallery/new/attach/Evaluator%3Acode%2Fsource?timeRangeKey=7d&category=AGENTS&evaluator=Evaluator%3Astale&template=Hallucination&proof=preserved"
    );
    expect(output?.getAttribute("data-response-quality-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&category=RESPONSE_QUALITY&proof=preserved"
    );
    expect(output?.getAttribute("data-template-gallery")).toBe(
      "/projects/project-1/evaluator-gallery?timeRangeKey=7d&category=RESPONSE_QUALITY&template=Correctness&proof=preserved"
    );
  });
});
