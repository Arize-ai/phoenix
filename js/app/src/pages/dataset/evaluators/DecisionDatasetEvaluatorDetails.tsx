import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text, Token } from "@phoenix/components";
import { describeQuestionScoring } from "@phoenix/components/evaluators/decision/DecisionEvaluatorSummary";
import {
  getQuestionScoringName,
  getQuestionScoringSettings,
  policyOutputToInput,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  evaluatorDetailsCardCSS,
  EvaluatorInputMappingDetails,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type { DecisionDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/DecisionDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { DecisionCell } from "@phoenix/pages/evaluators/DecisionCell";
import { getDecisionAnnotationName } from "@phoenix/utils/datasetEvaluatorUtils";

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
        evaluator {
          __typename
          ... on DecisionEvaluator {
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
            decisionVersion {
              id
              decisionId
              decision {
                name
              }
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
  const policy = policyOutputToInput(evaluator.scoringPolicy);

  return (
    <Flex direction="column" gap="size-300">
      <Flex direction="column" gap="size-100">
        <Heading level={2}>Decision</Heading>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-100">
            <DecisionCell decisionVersion={version} nameMaxWidth="24rem" />
            {/* The evaluator's version tag is an internal pin, so only the version is shown. */}
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
          const scoring = policy.questions.find(
            (scoring) => getQuestionScoringName(scoring) === question.name
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
                      {describeQuestionScoring(scoring, {
                        includeDirection: false,
                      })}
                    </Text>
                    <Text size="S">
                      <Text weight="heavy">Optimization Direction:</Text>{" "}
                      {
                        getQuestionScoringSettings(scoring)
                          .optimizationDirection
                      }
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
