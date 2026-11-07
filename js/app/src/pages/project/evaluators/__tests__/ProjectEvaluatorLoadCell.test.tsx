import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import {
  ProjectEvaluatorLoad,
  type ProjectEvaluatorEvaluationLoad,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorLoadCell";

installTestMatchMedia();

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

const MEASURED: ProjectEvaluatorEvaluationLoad = {
  evaluationCount: 4,
  meanEvaluationSeconds: 2,
  shareOfEvaluationTime: 0.25,
  isMeasured: true,
  excludesUntracedEvaluators: false,
};

function renderLoad(evaluationLoad: ProjectEvaluatorEvaluationLoad) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="dark">
        <ProjectEvaluatorLoad evaluationLoad={evaluationLoad} />
      </ThemeProvider>
    );
  });
  return container.textContent;
}

describe("ProjectEvaluatorLoad", () => {
  it("shows the share of evaluation time when the load is measured", () => {
    expect(renderLoad(MEASURED)).toContain("25");
  });

  it("shows -- before the evaluator has evaluated anything", () => {
    expect(
      renderLoad({
        ...MEASURED,
        evaluationCount: 0,
        meanEvaluationSeconds: null,
        shareOfEvaluationTime: null,
      })
    ).toBe("--");
  });

  it("says tracing is off rather than showing a share it cannot measure", () => {
    expect(
      renderLoad({
        ...MEASURED,
        meanEvaluationSeconds: null,
        shareOfEvaluationTime: null,
        isMeasured: false,
      })
    ).toBe("tracing off");
  });
});
