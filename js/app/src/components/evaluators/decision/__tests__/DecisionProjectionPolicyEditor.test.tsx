import { act, useState } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DecisionProjectionPolicyValue,
  DecisionQuestionDefinition,
} from "../decisionPolicyUtils";
import { buildDefaultPolicy } from "../decisionPolicyUtils";
import { DecisionProjectionPolicyEditor } from "../DecisionProjectionPolicyEditor";

const questions: DecisionQuestionDefinition[] = [
  { type: "predicate", name: "accurate" },
  { type: "choice", name: "tone", choices: ["good", "ok", "bad"] },
  { type: "scale", name: "clarity", levels: ["low", "high"] },
];

const inherited: DecisionProjectionPolicyValue = {
  questions: [
    {
      predicate: {
        name: "accurate",
        threshold: 0.7,
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      choice: {
        name: "tone",
        scores: [{ choice: "good", score: 1 }],
        optimizationDirection: "NONE",
      },
    },
    {
      scale: {
        name: "clarity",
        includeLabel: false,
        optimizationDirection: "NONE",
      },
    },
  ],
};

function Harness({
  initial,
  inheritedPolicy,
  onChange,
}: {
  initial: DecisionProjectionPolicyValue;
  inheritedPolicy?: DecisionProjectionPolicyValue;
  onChange: (value: DecisionProjectionPolicyValue) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DecisionProjectionPolicyEditor
      questions={questions}
      value={value}
      inheritedPolicy={inheritedPolicy}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("DecisionProjectionPolicyEditor", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (props: Parameters<typeof Harness>[0]) =>
    act(() => {
      root.render(<Harness {...props} />);
    });
  const input = (testId: string) =>
    container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
  const lastValue = () =>
    onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as DecisionProjectionPolicyValue;

  const typeInto = async (testId: string, text: string) => {
    const user = userEvent.setup();
    await act(async () => {
      await user.clear(input(testId));
      if (text) await user.type(input(testId), text);
      await user.tab();
    });
  };

  it("edits a predicate threshold", async () => {
    render({ initial: inherited, onChange });
    expect(input("decision-policy-accurate-threshold").value).toBe("0.7");
    await typeInto("decision-policy-accurate-threshold", "0.4");
    expect(lastValue().questions[0]).toEqual({
      predicate: {
        name: "accurate",
        threshold: 0.4,
        optimizationDirection: "MAXIMIZE",
      },
    });
  });

  it("shows a validation message for an out-of-range threshold", async () => {
    render({ initial: inherited, onChange });
    await typeInto("decision-policy-accurate-threshold", "3");
    expect(container.textContent).toContain(
      "Threshold must be a number from 0 to 1."
    );
  });

  it("sets and clears choice scores in declared order", async () => {
    render({ initial: buildDefaultPolicy(questions), onChange });
    await typeInto("decision-policy-tone-score-bad", "-1");
    await typeInto("decision-policy-tone-score-good", "2");
    expect(lastValue().questions[1]).toHaveProperty("choice.scores", [
      { choice: "good", score: 2 },
      { choice: "bad", score: -1 },
    ]);
    await typeInto("decision-policy-tone-score-bad", "");
    expect(lastValue().questions[1]).toHaveProperty("choice.scores", [
      { choice: "good", score: 2 },
    ]);
  });

  it("toggles the scale label", async () => {
    render({ initial: inherited, onChange });
    await act(async () => {
      await userEvent
        .setup()
        .click(
          container.querySelector(
            '[data-testid="decision-policy-clarity-include-label-switch"]'
          )!
        );
    });
    expect(lastValue().questions[2]).toHaveProperty("scale.includeLabel", true);
  });

  it("overrides a question and resets it to inherited", async () => {
    render({
      initial: { questions: [] },
      inheritedPolicy: inherited,
      onChange,
    });
    expect(input("decision-policy-accurate-threshold").value).toBe("0.7");
    expect(container.textContent).toContain("Inherited from the judge");
    expect(container.textContent).not.toContain("Reset to inherited");

    await typeInto("decision-policy-accurate-threshold", "0.2");
    // Only the changed question is in the sparse override.
    expect(lastValue().questions).toHaveLength(1);
    expect(lastValue().questions[0]).toHaveProperty("predicate.threshold", 0.2);
    expect(container.textContent).toContain("Overridden for this dataset");

    await act(async () => {
      await userEvent
        .setup()
        .click(
          container.querySelector(
            '[data-testid="decision-policy-reset-accurate-button"]'
          )!
        );
    });
    expect(lastValue().questions).toEqual([]);
    expect(input("decision-policy-accurate-threshold").value).toBe("0.7");
  });

  it("drops an override that is edited back to the inherited value", async () => {
    render({
      initial: { questions: [] },
      inheritedPolicy: inherited,
      onChange,
    });
    await typeInto("decision-policy-accurate-threshold", "0.2");
    await typeInto("decision-policy-accurate-threshold", "0.7");
    expect(lastValue().questions).toEqual([]);
  });
});
