import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AnnotationDetailsContent } from "../AnnotationDetailsContent";
import { AnnotationNameAndValue } from "../AnnotationNameAndValue";
import {
  type DecisionAnnotation,
  decisionProbabilities,
  describeScaleLevel,
  isRefusedDecisionAnnotation,
} from "../decisionAnnotation";

const base = {
  question: null,
  answer: null,
  requestedModel: "jev-latest",
  resolvedModel: null,
  modelProvider: null,
} satisfies Partial<DecisionAnnotation>;

const refused: DecisionAnnotation = {
  ...base,
  status: "REFUSED",
  question: { name: "q", type: "PREDICATE", choices: null, levels: null },
  // Refusals select no fields, so Relay types them as "%other".
  answer: { __typename: "%other" },
};

const answered: DecisionAnnotation = {
  ...base,
  status: "ANSWERED",
  question: {
    name: "q",
    type: "CHOICE",
    choices: [
      { value: "a", description: null },
      { value: "b", description: null },
    ],
    levels: null,
  },
  answer: {
    __typename: "ChoiceAnswer",
    choice: "a",
    confidence: 0.9,
    choiceProbabilities: [
      { value: "a", probability: 0.9 },
      { value: "b", probability: 0.1 },
    ],
  },
  resolvedModel: "gpt-x",
  modelProvider: "OPENAI",
};

const scale = (
  levels: { label: string; description: string | null }[] | null
): DecisionAnnotation => ({
  ...base,
  status: "ANSWERED",
  question: { name: "severity", type: "SCALE", choices: null, levels },
  answer: {
    __typename: "ScaleAnswer",
    expectedLevel: 0.8,
    confidence: 0.7,
    levelProbabilities: [
      { level: 0, probability: 0.2 },
      { level: 1, probability: 0.8 },
    ],
  },
});

describe("decision annotation helpers", () => {
  it("lists a choice's probabilities in the question's order", () => {
    expect(decisionProbabilities(answered)).toEqual([
      { key: "a", name: "a", probability: 0.9 },
      { key: "b", name: "b", probability: 0.1 },
    ]);
  });
  it("names scale levels by label, then description, then number", () => {
    const levels = [
      { label: "low", description: "Minor issue" },
      { label: "1", description: "Blocks the user" },
    ];
    expect(describeScaleLevel(0, levels).name).toBe("low");
    expect(describeScaleLevel(1, levels)).toEqual({
      name: "Blocks the user",
      title: "level 1: Blocks the user",
    });
    expect(describeScaleLevel(1, null).name).toBe("level 1");
  });
  it("detects refusals", () => {
    expect(isRefusedDecisionAnnotation({ decision: refused })).toBe(true);
    expect(isRefusedDecisionAnnotation({ decision: answered })).toBe(false);
    expect(isRefusedDecisionAnnotation({})).toBe(false);
  });
});

describe("decision annotation rendering", () => {
  const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });
  afterEach(() => {
    while (mounted.length > 0) {
      const { root, container } = mounted.pop()!;
      act(() => root.unmount());
      container.remove();
    }
  });
  const render = (node: React.ReactNode) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    act(() =>
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          {node}
        </ThemeProvider>
      )
    );
    return container;
  };
  const details = (decision: DecisionAnnotation) =>
    render(
      <AnnotationDetailsContent annotation={{ name: "judge", decision }} />
    ).querySelector("[data-testid=decision-details]")?.textContent;

  it("shows Refused instead of n/a", () => {
    const c = render(
      <AnnotationNameAndValue
        annotation={{ name: "judge", decision: refused }}
        displayPreference="score-and-label"
      />
    );
    expect(c.textContent).toContain("Refused");
    expect(c.textContent).not.toContain("n/a");
  });
  it("still shows n/a for non-decision empty annotations", () => {
    const c = render(
      <AnnotationNameAndValue
        annotation={{ name: "judge" }}
        displayPreference="score-and-label"
      />
    );
    expect(c.textContent).toContain("n/a");
  });
  it.each([
    ["ANSWERED", "Answered"],
    ["REFUSED", "Refused"],
    ["ERROR", "Error"],
  ] as const)("capitalizes the %s status", (status, label) => {
    expect(details({ ...base, status })).toContain(label);
  });
  it("shows confidence and choice probabilities", () => {
    const text = details(answered);
    expect(text).toContain("confidence");
    expect(text).toContain("p(b)");
    expect(text).toContain("gpt-x");
  });
  it("names scale probabilities by the levels the judge asked", () => {
    const text = details(
      scale([
        { label: "low", description: "Minor issue" },
        { label: "1", description: "Blocks the user" },
      ])
    );
    expect(text).toContain("expected level");
    expect(text).toContain("p(low)");
    expect(text).toContain("p(Blocks the user)");
  });
  it("falls back to level numbers when levels are unknown", () => {
    const text = details(scale(null));
    expect(text).toContain("p(level 0)");
    expect(text).toContain("p(level 1)");
  });
  it("shows nothing decision-specific for other annotations", () => {
    const c = render(<AnnotationDetailsContent annotation={{ name: "x" }} />);
    expect(c.querySelector("[data-testid=decision-details]")).toBeNull();
  });
});
