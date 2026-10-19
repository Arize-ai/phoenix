import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text, Token } from "@phoenix/components";
import {
  evaluatorDetailsCardCSS,
  EvaluatorInputMappingDetails,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type {
  DecisionDatasetEvaluatorDetails_datasetEvaluator$data,
  DecisionDatasetEvaluatorDetails_datasetEvaluator$key,
} from "@phoenix/pages/dataset/evaluators/__generated__/DecisionDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { DecisionCell } from "@phoenix/pages/evaluators/DecisionCell";

type ProjectionQuestion = NonNullable<
  DecisionDatasetEvaluatorDetails_datasetEvaluator$data["decisionProjectionPolicy"]
>["questions"][number];

export type EffectiveQuestionProjection = {
  projection: ProjectionQuestion;
  /** True when the dataset binding's policy replaces the judge's setting. */
  isOverridden: boolean;
};

/**
 * The effective scoring per question: the judge's projection policy with the
 * binding's sparse override applied. Each question the binding names replaces
 * the judge's setting for it; every other question inherits the judge's.
 */
export function resolveEffectiveProjections({
  judgePolicy,
  bindingPolicy,
}: {
  judgePolicy: readonly ProjectionQuestion[];
  bindingPolicy: readonly ProjectionQuestion[] | null | undefined;
}): EffectiveQuestionProjection[] {
  const overrides = new Map(
    (bindingPolicy ?? []).map((question) => [question.name, question])
  );
  return judgePolicy.map((question) => {
    const override = overrides.get(question.name);
    return override
      ? { projection: override, isOverridden: true }
      : { projection: question, isOverridden: false };
  });
}

/**
 * The annotation name a question writes under: the binding's name when the
 * judge has one question, otherwise `{binding}.{question}`.
 */
export function getDecisionAnnotationName({
  bindingName,
  questionName,
  questionCount,
}: {
  bindingName: string;
  questionName: string;
  questionCount: number;
}): string {
  return questionCount === 1 ? bindingName : `${bindingName}.${questionName}`;
}

function describeScoring(projection: ProjectionQuestion): string {
  switch (projection.__typename) {
    case "DecisionPredicateProjection":
      return `Predicate. Score is the probability of true; label is true at or above ${projection.threshold}.`;
    case "DecisionChoiceProjection":
      return (projection.scores ?? []).length > 0
        ? `Choice. Scores: ${(projection.scores ?? [])
            .map(({ choice, score }) => `${choice} (${score})`)
            .join(", ")}.`
        : "Choice. Label is the chosen value; no scores configured.";
    case "DecisionScaleProjection":
      return `Scale. Score is the expected level${
        projection.includeLabel ? "; labeled with the most probable level" : ""
      }.`;
    default:
      return "";
  }
}

export function DecisionDatasetEvaluatorDetails({
  datasetEvaluatorRef,
}: {
  datasetEvaluatorRef: DecisionDatasetEvaluatorDetails_datasetEvaluator$key;
}) {
  const datasetEvaluator = useFragment(
    graphql`
      fragment DecisionDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        name
        inputMapping {
          literalMapping
          pathMapping
        }
        decisionProjectionPolicy {
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
        evaluator {
          __typename
          ... on DecisionEvaluator {
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
            decisionVersionTag {
              name
            }
            decisionVersion {
              id
              decisionId
              sequenceNumber
              modelName
              modelProvider
              inputs {
                name
                description
              }
              questions {
                __typename
                ... on DecisionPredicateQuestion {
                  name
                  instructions
                }
                ... on DecisionChoiceQuestion {
                  name
                  instructions
                  choices {
                    value
                  }
                }
                ... on DecisionScaleQuestion {
                  name
                  instructions
                  levels {
                    label
                  }
                }
              }
            }
          }
        }
      }
    `,
    datasetEvaluatorRef
  );

  const evaluator = datasetEvaluator.evaluator;
  if (evaluator.__typename !== "DecisionEvaluator") {
    throw new Error(
      "DecisionDatasetEvaluatorDetails called for non-decision evaluator"
    );
  }
  const version = evaluator.decisionVersion;
  const effective = resolveEffectiveProjections({
    judgePolicy: evaluator.projectionPolicy.questions,
    bindingPolicy: datasetEvaluator.decisionProjectionPolicy?.questions,
  });

  return (
    <Flex direction="column" gap="size-300">
      <Flex direction="column" gap="size-100">
        <Heading level={2}>Decision</Heading>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-100">
            <DecisionCell decisionVersion={version} nameMaxWidth="24rem" />
            {evaluator.decisionVersionTag?.name && (
              <Token size="S" color="var(--global-color-gray-700)">
                {evaluator.decisionVersionTag.name}
              </Token>
            )}
          </Flex>
          <Flex alignItems="center" gap="size-50">
            <GenerativeProviderIcon
              provider={version.modelProvider}
              height={14}
            />
            <Text size="S" color="text-700">
              {version.modelName}
            </Text>
          </Flex>
        </Flex>
        {version.inputs.length > 0 && (
          <div css={evaluatorDetailsCardCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S" weight="heavy">
                Inputs
              </Text>
              {version.inputs.map((input) => (
                <Text key={input.name} size="S">
                  <Text weight="heavy">{input.name}</Text>
                  {input.description ? `: ${input.description}` : ""}
                </Text>
              ))}
            </Flex>
          </div>
        )}
      </Flex>
      <Flex direction="column" gap="size-100">
        <Heading level={2}>Questions and Scoring</Heading>
        {version.questions.map((question) => {
          if (!("name" in question)) return null;
          const scoring = effective.find(
            ({ projection }) => projection.name === question.name
          );
          return (
            <div
              key={question.name}
              css={evaluatorDetailsCardCSS}
              data-testid="decision-question"
            >
              <Flex direction="column" gap="size-100">
                <Flex alignItems="center" gap="size-100">
                  <Text weight="heavy">{question.name}</Text>
                  <Token size="S">
                    {question.__typename
                      .replace("Decision", "")
                      .replace("Question", "")}
                  </Token>
                  {scoring?.isOverridden && (
                    <Token size="S" color="var(--global-color-orange-500)">
                      Overridden
                    </Token>
                  )}
                </Flex>
                {"instructions" in question && (
                  <Text size="S" color="text-700">
                    {question.instructions}
                  </Text>
                )}
                {scoring && (
                  <>
                    <Text size="S">
                      <Text weight="heavy">Scoring:</Text>{" "}
                      {describeScoring(scoring.projection)}
                    </Text>
                    <Text size="S">
                      <Text weight="heavy">Optimization Direction:</Text>{" "}
                      {scoring.projection.optimizationDirection}
                    </Text>
                    <Text size="S">
                      <Text weight="heavy">Annotation Name:</Text>{" "}
                      {getDecisionAnnotationName({
                        bindingName: datasetEvaluator.name,
                        questionName: question.name,
                        questionCount: version.questions.length,
                      })}
                    </Text>
                  </>
                )}
              </Flex>
            </div>
          );
        })}
      </Flex>
      <EvaluatorInputMappingDetails
        inputMapping={datasetEvaluator.inputMapping}
      />
    </Flex>
  );
}
