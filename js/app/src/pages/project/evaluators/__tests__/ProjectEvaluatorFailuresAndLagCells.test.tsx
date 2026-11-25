import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { ProjectEvaluatorFailuresCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFailuresCell";
import { ProjectEvaluatorLagCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLagCell";

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

function render(element: React.ReactElement) {
  act(() => {
    root.render(<ThemeProvider>{element}</ThemeProvider>);
  });
}

describe("ProjectEvaluatorFailuresCell", () => {
  it("renders a placeholder instead of crashing when the summary is not loaded", () => {
    render(<ProjectEvaluatorFailuresCell failureSummary={undefined} />);
    expect(container.textContent).toBe("--");
  });

  it("renders the failure rate when the summary is loaded", () => {
    render(
      <ProjectEvaluatorFailuresCell
        failureSummary={{
          failedCount: 1,
          evaluatedCount: 4,
          failureRate: 0.25,
          lastFailedAt: null,
          lastError: null,
        }}
      />
    );
    expect(container.textContent).toContain("25");
  });
});

describe("ProjectEvaluatorLagCell", () => {
  it("renders a placeholder instead of crashing when the lag is not loaded", () => {
    render(<ProjectEvaluatorLagCell lag={undefined} />);
    expect(container.textContent).toBe("--");
  });
});
