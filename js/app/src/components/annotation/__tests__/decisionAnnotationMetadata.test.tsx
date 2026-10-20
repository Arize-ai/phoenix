import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AnnotationDetailsContent } from "../AnnotationDetailsContent";
import { AnnotationNameAndValue } from "../AnnotationNameAndValue";
import {
  countDecisionStatuses,
  isRefusedDecisionAnnotation,
  parseDecisionAnnotationMetadata,
} from "../decisionAnnotationMetadata";

const refused = {
  decision: {
    status: "refused",
    question: { name: "q", type: "predicate" },
  },
};
const answered = {
  decision: {
    status: "answered",
    question: { name: "q", type: "choice" },
    answer: {
      choice: "a",
      confidence: 0.9,
      probabilities: { a: 0.9, b: 0.1 },
    },
    resolved_model: "gpt-x",
    provider: "openai",
  },
};

describe("parseDecisionAnnotationMetadata", () => {
  it("returns null for missing or unknown input", () => {
    expect(parseDecisionAnnotationMetadata(undefined)).toBeNull();
    expect(parseDecisionAnnotationMetadata({})).toBeNull();
    expect(parseDecisionAnnotationMetadata({ decision: "x" })).toBeNull();
    expect(
      parseDecisionAnnotationMetadata({ decision: { status: "weird" } })
    ).toBeNull();
  });
  it("parses answered choice metadata", () => {
    const s = parseDecisionAnnotationMetadata(answered)!;
    expect(s.status).toBe("answered");
    expect(s.confidence).toBe(0.9);
    expect(s.probabilities).toEqual([
      { key: "a", probability: 0.9 },
      { key: "b", probability: 0.1 },
    ]);
    expect(s.resolvedModel).toBe("gpt-x");
  });
  it("parses a scale's levels, and none for older annotations", () => {
    const levels = [{ label: "low", description: null }];
    expect(
      parseDecisionAnnotationMetadata({
        decision: {
          status: "answered",
          question: { name: "q", type: "scale", levels },
        },
      })!.question?.levels
    ).toEqual(levels);
    expect(parseDecisionAnnotationMetadata(refused)!.question?.levels).toBe(
      null
    );
  });
  it("parses predicate and tolerates a bad answer", () => {
    const s = parseDecisionAnnotationMetadata({
      decision: { status: "answered", answer: { probability: 0.3 } },
    })!;
    expect(s.probability).toBe(0.3);
    expect(
      parseDecisionAnnotationMetadata({
        decision: { status: "answered", answer: 5 },
      })!.confidence
    ).toBeNull();
  });
  it("detects refusals and counts statuses", () => {
    expect(isRefusedDecisionAnnotation({ metadata: refused })).toBe(true);
    expect(isRefusedDecisionAnnotation({ metadata: answered })).toBe(false);
    expect(
      countDecisionStatuses([
        { metadata: refused },
        { metadata: answered },
        { metadata: {} },
      ])
    ).toEqual({ answered: 1, refused: 1, error: 0 });
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
  it("shows Refused instead of n/a", () => {
    const c = render(
      <AnnotationNameAndValue
        annotation={{ name: "judge", metadata: refused }}
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
    ["answered", "Answered"],
    ["refused", "Refused"],
    ["error", "Error"],
  ])("capitalizes the %s status", (status, label) => {
    const container = render(
      <AnnotationDetailsContent
        annotation={{ name: "judge", metadata: { decision: { status } } }}
      />
    );
    expect(
      container.querySelector("[data-testid=decision-details]")?.textContent
    ).toContain(label);
  });
  it("identifies scale probabilities by their zero-based level", () => {
    const container = render(
      <AnnotationDetailsContent
        annotation={{
          name: "judge",
          metadata: {
            decision: {
              status: "answered",
              question: { name: "severity", type: "scale" },
              answer: {
                expected_level: 0.8,
                probabilities: { "0": 0.2, "1": 0.8 },
              },
            },
          },
        }}
      />
    );
    const text = container.querySelector(
      "[data-testid=decision-details]"
    )?.textContent;
    expect(text).toContain("p(level 0)");
    expect(text).toContain("p(level 1)");
  });
  it("names scale probabilities by the levels the judge asked", () => {
    const container = render(
      <AnnotationDetailsContent
        annotation={{
          name: "judge",
          metadata: {
            decision: {
              status: "answered",
              question: {
                name: "severity",
                type: "scale",
                levels: [
                  { label: "low", description: "Minor issue" },
                  { label: "1", description: "Blocks the user" },
                ],
              },
              answer: {
                expected_level: 0.8,
                probabilities: { "0": 0.2, "1": 0.8 },
              },
            },
          },
        }}
      />
    );
    const text = container.querySelector(
      "[data-testid=decision-details]"
    )?.textContent;
    expect(text).toContain("p(low)");
    // A label that is only the level's number falls back to its description.
    expect(text).toContain("p(Blocks the user)");
  });
  it("shows confidence and probabilities in details", () => {
    const c = render(
      <AnnotationDetailsContent
        annotation={{ name: "judge", label: "a", metadata: answered }}
      />
    );
    const text = c.querySelector("[data-testid=decision-details]")?.textContent;
    expect(text).toContain("confidence");
    expect(text).toContain("p(b)");
  });
});
