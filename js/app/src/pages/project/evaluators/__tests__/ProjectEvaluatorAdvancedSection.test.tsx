import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { ProjectEvaluatorAdvancedSection } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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

const SCOPE: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "",
  samplingRate: 1,
  evaluationDelaySeconds: 0,
  tracingEnabled: false,
};

function renderSection(onScopeChange: (scope: ProjectEvaluatorScope) => void) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="dark">
        <ProjectEvaluatorAdvancedSection
          scope={SCOPE}
          onScopeChange={onScopeChange}
        />
      </ThemeProvider>
    );
  });
}

describe("ProjectEvaluatorAdvancedSection", () => {
  it("starts collapsed with the tracing state in its toggle's accessible name", () => {
    renderSection(() => {});
    const toggle = container.querySelector<HTMLButtonElement>(
      "button[aria-expanded]"
    );
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.textContent).toContain("Advanced");
    expect(toggle?.textContent).toContain("Tracing off");
    expect(
      toggle?.querySelector('[aria-hidden="true"]')?.textContent ?? ""
    ).not.toContain("Tracing off");
  });

  it("turns tracing on from the switch once expanded", () => {
    const changes: ProjectEvaluatorScope[] = [];
    renderSection((scope) => changes.push(scope));
    act(() => {
      container
        .querySelector<HTMLButtonElement>("button[aria-expanded]")
        ?.click();
    });
    act(() => {
      container
        .querySelector<HTMLInputElement>('input[role="switch"]')
        ?.click();
    });
    expect(changes).toEqual([{ ...SCOPE, tracingEnabled: true }]);
  });
});
