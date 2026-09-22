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
      data-list={paths.list}
      data-template={paths.newLlmFromTemplate("Correctness")}
      data-new-llm={paths.creation.newLlm}
      data-new-code={paths.creation.newCode}
      data-copy-llm={paths.creation.copyLlm("Evaluator:llm/source")}
      data-copy-code={paths.creation.copyCode("Evaluator:code/source")}
      data-attach-code={paths.creation.attachCode("Evaluator:code/source")}
      data-edit={paths.edit("ProjectEvaluator:1")}
      data-compare={paths.compare({
        a: "ProjectEvaluator:a/source",
        b: "ProjectEvaluator:b/source",
      })}
    />
  );
}

function renderAt(url: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
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
  return (name: string) => output?.getAttribute(`data-${name}`);
}

describe("useProjectEvaluatorPaths", () => {
  it("builds evaluator destinations while preserving view state", () => {
    const path = renderAt(
      "/projects/project-1/evaluators?timeRangeKey=7d&proof=preserved"
    );

    expect(path("list")).toBe(
      "/projects/project-1/evaluators?timeRangeKey=7d&proof=preserved"
    );
    expect(path("template")).toBe(
      "/projects/project-1/evaluators/new/template/Correctness?timeRangeKey=7d&proof=preserved"
    );
    expect(path("new-llm")).toBe(
      "/projects/project-1/evaluators/new/llm?timeRangeKey=7d&proof=preserved"
    );
    expect(path("new-code")).toBe(
      "/projects/project-1/evaluators/new/code?timeRangeKey=7d&proof=preserved"
    );
    expect(path("copy-llm")).toBe(
      "/projects/project-1/evaluators/new/copy-llm/Evaluator%3Allm%2Fsource?timeRangeKey=7d&proof=preserved"
    );
    expect(path("copy-code")).toBe(
      "/projects/project-1/evaluators/new/copy-code/Evaluator%3Acode%2Fsource?timeRangeKey=7d&proof=preserved"
    );
    expect(path("attach-code")).toBe(
      "/projects/project-1/evaluators/new/attach/Evaluator%3Acode%2Fsource?timeRangeKey=7d&proof=preserved"
    );
    expect(path("edit")).toBe(
      "/projects/project-1/evaluators/ProjectEvaluator%3A1/edit?timeRangeKey=7d&proof=preserved"
    );
    expect(path("compare")).toBe(
      "/projects/project-1/evaluators/compare?timeRangeKey=7d&proof=preserved&evaluatorId=ProjectEvaluator%3Aa%2Fsource&evaluatorId=ProjectEvaluator%3Ab%2Fsource"
    );
  });

  it("removes stale compare ids from non-compare destinations", () => {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/projects/project-1/evaluators/compare?timeRangeKey=7d&evaluatorId=old-a&evaluatorId=old-b&compareSelection=stale",
          ]}
        >
          <Routes>
            <Route
              path="/projects/:projectId/evaluators/compare"
              element={<TestProjectEvaluatorPaths />}
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const output = container.querySelector("output");
    expect(output?.getAttribute("data-new-llm")).toBe(
      "/projects/project-1/evaluators/new/llm?timeRangeKey=7d"
    );
    expect(output?.getAttribute("data-compare")).toContain(
      "?timeRangeKey=7d&evaluatorId=ProjectEvaluator%3Aa%2Fsource&evaluatorId=ProjectEvaluator%3Ab%2Fsource"
    );
  });
});
