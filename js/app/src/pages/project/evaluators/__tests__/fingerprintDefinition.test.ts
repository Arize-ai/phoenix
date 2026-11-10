import { describe, expect, it } from "vitest";

import type { OptimizationDirection } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorTestBenchPreviewMutation.graphql";
import {
  fingerprintDefinition,
  type PreviewEvaluatorInput,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";

/**
 * A bench result goes stale when the fingerprint of what it ran against
 * changes. A decision's direction only says which answer is good, so a
 * direction edit recolours a result rather than marking it stale.
 */
describe("fingerprintDefinition", () => {
  const decision = ({
    optimizationDirection,
    threshold = 0.5,
  }: {
    optimizationDirection: OptimizationDirection;
    threshold?: number;
  }): PreviewEvaluatorInput => ({
    inlineDecisionEvaluator: {
      name: "accurate",
      decisionVersion: {
        modelName: "gpt-4o",
        modelProvider: "OPENAI",
        templateFormat: "MUSTACHE",
        state: { text: "Is the answer accurate? {{output}}" },
        questions: [
          { predicate: { name: "accurate", instructions: "Is it accurate?" } },
        ],
      },
      scoringPolicy: {
        questions: [
          { predicate: { name: "accurate", threshold, optimizationDirection } },
        ],
      },
    },
  });
  const inputMapping = { literalMapping: {}, pathMapping: {} };

  it("keeps a result current across a direction edit", () => {
    expect(
      fingerprintDefinition(
        decision({ optimizationDirection: "MINIMIZE" }),
        inputMapping
      )
    ).toEqual(
      fingerprintDefinition(
        decision({ optimizationDirection: "MAXIMIZE" }),
        inputMapping
      )
    );
  });

  it("marks a result stale across a threshold edit", () => {
    expect(
      fingerprintDefinition(
        decision({ optimizationDirection: "MAXIMIZE", threshold: 0.8 }),
        inputMapping
      )
    ).not.toEqual(
      fingerprintDefinition(
        decision({ optimizationDirection: "MAXIMIZE" }),
        inputMapping
      )
    );
  });
});
