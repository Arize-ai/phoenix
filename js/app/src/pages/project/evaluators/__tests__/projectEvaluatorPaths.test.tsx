import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";

import {
  useProjectEvaluatorCreationPaths,
  useProjectEvaluatorPaths,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

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
  const creation = useProjectEvaluatorCreationPaths();
  return (
    <>
      <output
        data-list={paths.list}
        data-gallery={paths.gallery()}
        data-gallery-category={paths.gallery("AGENTS")}
        data-details={paths.details("ProjectEvaluator:1")}
        data-edit={paths.edit("ProjectEvaluator:1")}
        data-compare={paths.compare({
          a: "ProjectEvaluator:a/source",
          b: "ProjectEvaluator:b/source",
        })}
        data-template={creation.newLlmFromTemplate("Correctness")}
        data-new-llm={creation.newLlm}
        data-new-code={creation.newCode}
        data-copy-llm={creation.copyLlm("Evaluator:llm/source")}
        data-copy-code={creation.copyCode("Evaluator:code/source")}
        data-attach-code={creation.attachCode("Evaluator:code/source")}
      />
      <Outlet />
    </>
  );
}

/**
 * Mirrors the app's nesting: the creation routes are children of both the
 * list route and the gallery route, so the component under test renders as
 * either parent's element.
 */
function renderAt(url: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/projects/:projectId/evaluators"
            element={<TestProjectEvaluatorPaths />}
          >
            <Route path="new/llm" element={null} />
            <Route path="gallery" element={<TestProjectEvaluatorPaths />}>
              <Route path="new/llm" element={null} />
            </Route>
          </Route>
          <Route
            path="/projects/:projectId/evaluators/compare"
            element={<TestProjectEvaluatorPaths />}
          />
        </Routes>
      </MemoryRouter>
    );
  });
  const outputs = Array.from(container.querySelectorAll("output"));
  return (name: string, index = 0) =>
    outputs[index]?.getAttribute(`data-${name}`);
}

describe("useProjectEvaluatorPaths", () => {
  it("builds evaluator destinations while preserving view state", () => {
    const path = renderAt(
      "/projects/project-1/evaluators?timeRangeKey=7d&proof=preserved"
    );

    expect(path("list")).toBe(
      "/projects/project-1/evaluators?timeRangeKey=7d&proof=preserved"
    );
    expect(path("gallery")).toBe(
      "/projects/project-1/evaluators/gallery?timeRangeKey=7d&proof=preserved"
    );
    expect(path("gallery-category")).toBe(
      "/projects/project-1/evaluators/gallery?timeRangeKey=7d&proof=preserved&category=AGENTS"
    );
    expect(path("details")).toBe(
      "/projects/project-1/evaluators/ProjectEvaluator%3A1?timeRangeKey=7d&proof=preserved"
    );
    expect(path("edit")).toBe(
      "/projects/project-1/evaluators/ProjectEvaluator%3A1/edit?timeRangeKey=7d&proof=preserved"
    );
    expect(path("compare")).toBe(
      "/projects/project-1/evaluators/compare?timeRangeKey=7d&proof=preserved&evaluatorId=ProjectEvaluator%3Aa%2Fsource&evaluatorId=ProjectEvaluator%3Ab%2Fsource"
    );
  });

  it("removes stale compare ids from non-compare destinations", () => {
    const path = renderAt(
      "/projects/project-1/evaluators/compare?timeRangeKey=7d&evaluatorId=old-a&evaluatorId=old-b&compareSelection=stale"
    );

    expect(path("list")).toBe("/projects/project-1/evaluators?timeRangeKey=7d");
    expect(path("compare")).toContain(
      "?timeRangeKey=7d&evaluatorId=ProjectEvaluator%3Aa%2Fsource&evaluatorId=ProjectEvaluator%3Ab%2Fsource"
    );
  });

  it("drops the gallery category from destinations that leave the gallery", () => {
    const path = renderAt(
      "/projects/project-1/evaluators/gallery?timeRangeKey=7d&category=AGENTS"
    );

    expect(path("list")).toBe("/projects/project-1/evaluators?timeRangeKey=7d");
    expect(path("edit")).toBe(
      "/projects/project-1/evaluators/ProjectEvaluator%3A1/edit?timeRangeKey=7d"
    );
    expect(path("gallery")).toBe(
      "/projects/project-1/evaluators/gallery?timeRangeKey=7d"
    );
  });
});

describe("useProjectEvaluatorCreationPaths", () => {
  it("anchors the creation slideovers at the list when rendered by the list", () => {
    const path = renderAt(
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
  });

  it("anchors the creation slideovers at the gallery when rendered by the gallery", () => {
    const path = renderAt(
      "/projects/project-1/evaluators/gallery?timeRangeKey=7d&category=AGENTS"
    );

    // The list's element (index 0) and the gallery's element (index 1) each
    // resolve against their own route.
    expect(path("new-llm", 0)).toBe(
      "/projects/project-1/evaluators/new/llm?timeRangeKey=7d&category=AGENTS"
    );
    expect(path("new-llm", 1)).toBe(
      "/projects/project-1/evaluators/gallery/new/llm?timeRangeKey=7d&category=AGENTS"
    );
    expect(path("template", 1)).toBe(
      "/projects/project-1/evaluators/gallery/new/template/Correctness?timeRangeKey=7d&category=AGENTS"
    );
  });

  it("keeps anchoring at the parent while a creation slideover is open", () => {
    const path = renderAt(
      "/projects/project-1/evaluators/gallery/new/llm?timeRangeKey=7d"
    );

    expect(path("new-code", 0)).toBe(
      "/projects/project-1/evaluators/new/code?timeRangeKey=7d"
    );
    expect(path("new-code", 1)).toBe(
      "/projects/project-1/evaluators/gallery/new/code?timeRangeKey=7d"
    );
  });
});
