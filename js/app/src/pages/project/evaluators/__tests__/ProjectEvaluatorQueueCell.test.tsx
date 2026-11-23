import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { ProjectEvaluatorQueueCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueCell";

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

function renderQueueCell(queuedCount: number) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="dark">
        <ProjectEvaluatorQueueCell
          queuedWork={{ queuedCount, oldestWaitingOrRetryingAt: null }}
        />
      </ThemeProvider>
    );
  });
}

describe("ProjectEvaluatorQueueCell", () => {
  it("shows an empty queue as 0, not as missing", () => {
    renderQueueCell(0);
    expect(container.textContent).toBe("0");
  });

  it("shows the queued count", () => {
    renderQueueCell(12);
    expect(container.textContent).toBe("12");
  });
});
