import { graphql, useFragment } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import { Link } from "@phoenix/components/core/Link";

import type { DecisionEvaluatorSummary_evaluator$key } from "./__generated__/DecisionEvaluatorSummary_evaluator.graphql";
import type { DecisionQuestionScoringValue } from "./decisionPolicyUtils";
import {
  getQuestionScoringName,
  policyOutputToInput,
} from "./decisionPolicyUtils";

export type DecisionEvaluatorSummaryProps = {
  evaluator: DecisionEvaluatorSummary_evaluator$key;
};

/** Describes one question's scoring in a short sentence. */
export function describeQuestionScoring(
  question: DecisionQuestionScoringValue,
  { includeDirection = true }: { includeDirection?: boolean } = {}
): string {
  const direction = (value: string) =>
    !includeDirection
      ? ""
      : value === "MAXIMIZE"
        ? "; higher is better"
        : value === "MINIMIZE"
          ? "; lower is better"
          : "; no optimization direction";
  if ("predicate" in question) {
    const { threshold, optimizationDirection } = question.predicate;
    return `Yes / No: true at probability >= ${threshold}${direction(optimizationDirection)}`;
  }
  if ("choice" in question) {
    const { scores, optimizationDirection } = question.choice;
    const scored =
      scores.length > 0
        ? scores.map(({ choice, score }) => `${choice} = ${score}`).join(", ")
        : "no choice scores";
    return `Choice: ${scored}${direction(optimizationDirection)}`;
  }
  const { includeLabel, optimizationDirection } = question.scale;
  return `Scale: ${includeLabel ? "labeled with the most probable level" : "score only"}${direction(optimizationDirection)}`;
}

/**
 * Read-only description of a decision evaluator: the decision and version it runs
 * (linked), its model, and each question's scoring.
 */
export function DecisionEvaluatorSummary({
  evaluator,
}: DecisionEvaluatorSummaryProps) {
  const data = useFragment<DecisionEvaluatorSummary_evaluator$key>(
    graphql`
      fragment DecisionEvaluatorSummary_evaluator on DecisionEvaluator {
        decisionVersion {
          id
          decisionId
          decision {
            name
          }
          sequenceNumber
          modelProvider
          modelName
        }
        decisionVersionTag {
          name
        }
        scoringPolicy {
          questions {
            __typename
            name
            optimizationDirection
            ... on DecisionPredicateScoring {
              threshold
            }
            ... on DecisionChoiceScoring {
              scores {
                choice
                score
              }
            }
            ... on DecisionScaleScoring {
              includeLabel
            }
          }
        }
      }
    `,
    evaluator
  );
  const { decisionVersion } = data;
  const policy = policyOutputToInput(data.scoringPolicy);

  return (
    <Flex
      direction="column"
      gap="size-100"
      data-testid="decision-evaluator-summary"
    >
      <Flex direction="row" gap="size-100" alignItems="center" wrap>
        <Link
          to={`/decisions/${decisionVersion.decisionId}/versions/${decisionVersion.id}`}
        >
          {decisionVersion.decision.name} · Version{" "}
          {decisionVersion.sequenceNumber}
          {data.decisionVersionTag.name
            ? ` (${data.decisionVersionTag.name})`
            : ""}
        </Link>
        <Text color="text-700">
          {decisionVersion.modelProvider} / {decisionVersion.modelName}
        </Text>
      </Flex>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {policy.questions.map((question) => {
          const name = getQuestionScoringName(question);
          return (
            <li key={name}>
              <Text weight="heavy">{name}</Text>{" "}
              <Text color="text-700">{describeQuestionScoring(question)}</Text>
            </li>
          );
        })}
      </ul>
    </Flex>
  );
}
