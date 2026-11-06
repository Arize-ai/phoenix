import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";

import { useProjectRootPath } from "../useProjectRootPath";

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

function TestProjectRootPath() {
  const { rootPath, tab } = useProjectRootPath();
  return (
    <output>
      {rootPath}|{tab}
    </output>
  );
}

function renderProjectRoute(path: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/projects/:projectId/:tab"
            element={<TestProjectRootPath />}
          />
        </Routes>
      </MemoryRouter>
    );
  });
}

describe("useProjectRootPath", () => {
  it("returns the project root path and tab for unencoded project ids", () => {
    renderProjectRoute("/projects/project-1/spans");

    expect(container.textContent).toBe("/projects/project-1|spans");
  });

  it("finds encoded project id path segments by decoded route params", () => {
    renderProjectRoute("/projects/UHJvamVjdDo0Nw%3D%3D/config");

    expect(container.textContent).toBe("/projects/UHJvamVjdDo0Nw%3D%3D|config");
  });
});
