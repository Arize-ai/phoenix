import { graphql, useFragment } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import { Link } from "@phoenix/components/core/Link";

import type { DecisionJudgeSummary_evaluator$key } from "./__generated__/DecisionJudgeSummary_evaluator.graphql";
import type { DecisionQuestionProjectionValue } from "./decisionPolicyUtils";
import {
  getQuestionProjectionName,
  policyOutputToInput,
} from "./decisionPolicyUtils";

export type DecisionJudgeSummaryProps = {
  evaluator: DecisionJudgeSummary_evaluator$key;
};

/** Describes one question's scoring in a short sentence. */
export function describeQuestionScoring(
  question: DecisionQuestionProjectionValue,
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
    return `Predicate: true at probability >= ${threshold}${direction(optimizationDirection)}`;
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
 * Read-only description of a decision judge: the decision and version it runs
 * (linked), its model, and each question's scoring.
 */
export function DecisionJudgeSummary({ evaluator }: DecisionJudgeSummaryProps) {
  const data = useFragment<DecisionJudgeSummary_evaluator$key>(
    graphql`
      fragment DecisionJudgeSummary_evaluator on DecisionEvaluator {
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
        projectionPolicy {
          questions {
            __typename
            name
            optimizationDirection
            ... on DecisionPredicateProjection {
              threshold
            }
            ... on DecisionChoiceProjection {
              scores {
                choice
                score
              }
            }
            ... on DecisionScaleProjection {
              includeLabel
            }
          }
        }
      }
    `,
    evaluator
  );
  const { decisionVersion } = data;
  const policy = policyOutputToInput(data.projectionPolicy);

  return (
    <Flex
      direction="column"
      gap="size-100"
      data-testid="decision-judge-summary"
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
          const name = getQuestionProjectionName(question);
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
