import { css } from "@emotion/react";
import { Fragment } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Flex, ListItem, Text } from "@phoenix/components";
import { describeQuestionScoring } from "@phoenix/components/evaluators/decision/DecisionEvaluatorSummary";
import {
  getQuestionScoringName,
  policyOutputToInput,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
  EvaluatorInputMappingDetails,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { DecisionCell } from "@phoenix/pages/evaluators/DecisionCell";
import type {
  DecisionProjectEvaluatorDetails_projectEvaluator$data,
  DecisionProjectEvaluatorDetails_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/DecisionProjectEvaluatorDetails_projectEvaluator.graphql";

const templateCSS = css`
  margin: 0;
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-s);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const optionGridCSS = css`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: var(--global-dimension-size-200);
  row-gap: var(--global-dimension-size-50);
`;

type DecisionEvaluatorData = Extract<
  DecisionProjectEvaluatorDetails_projectEvaluator$data["evaluator"],
  { __typename: "DecisionEvaluator" }
>;
type DecisionQuestion =
  DecisionEvaluatorData["decisionVersion"]["questions"][number];

type Option = { key: string; label: string; description?: string | null };

function getQuestionOptions(question: DecisionQuestion): Option[] {
  switch (question.__typename) {
    case "DecisionPredicateQuestion":
      return [
        { key: "true", label: "true", description: question.criteria?.true },
        { key: "false", label: "false", description: question.criteria?.false },
      ].filter((option) => option.description);
    case "DecisionChoiceQuestion":
      return question.choices.map((choice) => ({
        key: choice.value,
        label: choice.value,
        description: choice.description,
      }));
    case "DecisionScaleQuestion":
      return question.levels.map((level, index) => ({
        key: String(index),
        label: level.label,
        description: level.description,
      }));
    default:
      return [];
  }
}

function OptionGrid({ options }: { options: readonly Option[] }) {
  if (options.length === 0) {
    return null;
  }
  return (
    <div css={optionGridCSS}>
      {options.map(({ key, label, description }) => (
        <Fragment key={key}>
          <Text size="S" color="text-700">
            {label}
          </Text>
          <Text size="S">{description ?? ""}</Text>
        </Fragment>
      ))}
    </div>
  );
}

export function DecisionProjectEvaluatorDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: DecisionProjectEvaluatorDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment DecisionProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {
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
              state {
                __typename
                ... on DecisionTextState {
                  template
                }
                ... on DecisionInputState {
                  input
                }
              }
              questions {
                __typename
                ... on DecisionPredicateQuestion {
                  name
                  instructions
                  criteria {
                    true
                    false
                  }
                }
                ... on DecisionChoiceQuestion {
                  name
                  instructions
                  choices {
                    value
                    description
                  }
                }
                ... on DecisionScaleQuestion {
                  name
                  instructions
                  levels {
                    label
                    description
                  }
                }
              }
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );

  const evaluator = projectEvaluator.evaluator;
  if (evaluator.__typename !== "DecisionEvaluator") {
    throw new Error(
      "DecisionProjectEvaluatorDetails called for non-decision evaluator"
    );
  }
  const version = evaluator.decisionVersion;
  const policy = policyOutputToInput(evaluator.scoringPolicy);
  const { state } = version;

  return (
    <>
      <Card
        title="Decision"
        titleExtra={
          <DecisionCell decisionVersion={version} nameMaxWidth="24rem" />
        }
        extra={
          <Flex alignItems="center" gap="size-50">
            <GenerativeProviderIcon
              provider={version.modelProvider}
              height={14}
            />
            <Text size="S" color="text-700">
              {version.modelName}
            </Text>
          </Flex>
        }
      >
        <EvaluatorDetailList>
          {state.__typename === "DecisionTextState" ? (
            <ListItem>
              <Flex direction="column" gap="size-100">
                <Text size="S" color="text-700">
                  State
                </Text>
                <pre css={templateCSS}>{state.template}</pre>
              </Flex>
            </ListItem>
          ) : (
            <EvaluatorDetailRow label="State">
              {state.__typename === "DecisionInputState" ? (
                <Text size="S" fontFamily="mono">
                  {state.input}
                </Text>
              ) : (
                "Inputs as JSON"
              )}
            </EvaluatorDetailRow>
          )}
          {version.questions.map((question) => {
            if (question.__typename === "%other") {
              return null;
            }
            const scoring = policy.questions.find(
              (scoring) => getQuestionScoringName(scoring) === question.name
            );
            return (
              <ListItem key={question.name} data-testid="decision-question">
                <Flex direction="column" gap="size-100">
                  <Text weight="heavy">{question.name}</Text>
                  <Text size="S" color="text-700">
                    {question.instructions}
                  </Text>
                  <OptionGrid options={getQuestionOptions(question)} />
                  {scoring ? (
                    <Text size="S">
                      {describeQuestionScoring(scoring, {
                        includeDirection: false,
                      })}
                    </Text>
                  ) : null}
                </Flex>
              </ListItem>
            );
          })}
        </EvaluatorDetailList>
      </Card>
      <EvaluatorInputMappingDetails
        inputMapping={projectEvaluator.inputMapping}
      />
    </>
  );
}
