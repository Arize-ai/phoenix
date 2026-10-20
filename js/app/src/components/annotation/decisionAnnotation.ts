import { graphql } from "react-relay";

import type { decisionAnnotation_annotation$data } from "./__generated__/decisionAnnotation_annotation.graphql";

/**
 * A decision judge's typed result on an experiment-run annotation. Spread it
 * unmasked (`@relay(mask: false)`) beside an annotation's other fields, so the
 * `decision` field travels with the annotation to the shared annotation views.
 */
export const decisionAnnotationFragment = graphql`
  fragment decisionAnnotation_annotation on ExperimentRunAnnotation {
    decision {
      status
      question {
        name
        type
        choices {
          value
          description
        }
        levels {
          label
          description
        }
      }
      answer {
        __typename
        ... on PredicateAnswer {
          probability
        }
        ... on ChoiceAnswer {
          choice
          confidence
          choiceProbabilities: probabilities {
            value
            probability
          }
        }
        ... on ScaleAnswer {
          expectedLevel
          confidence
          levelProbabilities: probabilities {
            level
            probability
          }
        }
      }
      requestedModel
      resolvedModel
      modelProvider
    }
  }
`;

export type DecisionAnnotation = NonNullable<
  decisionAnnotation_annotation$data["decision"]
>;

type DecisionScaleLevel = NonNullable<
  NonNullable<DecisionAnnotation["question"]>["levels"]
>[number];

/** One option's or level's probability, named for display. */
export type DecisionProbability = {
  key: string;
  name: string;
  /** Full text for a name that may be truncated */
  title?: string;
  probability: number;
};

/**
 * How to name a scale level's probability: its label, or its description when
 * the label is only the level's number, or the number when levels are unknown.
 */
export function describeScaleLevel(
  level: number,
  levels: readonly DecisionScaleLevel[] | null | undefined
): { name: string; title: string } {
  const key = String(level);
  const known = levels?.[level];
  if (!known) return { name: `level ${key}`, title: `level ${key}` };
  const name =
    known.label && known.label !== key
      ? known.label
      : (known.description ?? `level ${key}`);
  const title = [
    `level ${key}`,
    known.label !== key ? known.label : null,
    known.description,
  ]
    .filter(Boolean)
    .join(": ");
  return { name, title };
}

/** A choice's or scale's probabilities, in the question's order. */
export function decisionProbabilities(
  decision: DecisionAnnotation
): DecisionProbability[] {
  const answer = decision.answer;
  if (answer?.__typename === "ChoiceAnswer") {
    return answer.choiceProbabilities.map(({ value, probability }) => ({
      key: value,
      name: value,
      probability,
    }));
  }
  if (answer?.__typename === "ScaleAnswer") {
    return answer.levelProbabilities.map(({ level, probability }) => ({
      key: String(level),
      ...describeScaleLevel(level, decision.question?.levels),
      probability,
    }));
  }
  return [];
}

export function isRefusedDecisionAnnotation(annotation: {
  decision?: DecisionAnnotation | null;
}): boolean {
  return annotation.decision?.status === "REFUSED";
}
