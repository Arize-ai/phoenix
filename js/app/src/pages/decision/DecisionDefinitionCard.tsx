import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  Heading,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { DECISION_QUESTION_TYPES } from "@phoenix/pages/playground/decisionUtils";

import type {
  DecisionDefinitionCard_version$data,
  DecisionDefinitionCard_version$key,
} from "./__generated__/DecisionDefinitionCard_version.graphql";
import { decisionVersionToText } from "./decisionVersionUtils";

const levelListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const preCSS = css`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const QUESTION_TYPE_BY_TYPENAME = {
  DecisionPredicateQuestion: "predicate",
  DecisionChoiceQuestion: "choice",
  DecisionScaleQuestion: "scale",
} as const;

/** The question type as the playground's question editor names it. */
function getQuestionTypeLabel(typename: string): string | null {
  const type =
    QUESTION_TYPE_BY_TYPENAME[
      typename as keyof typeof QUESTION_TYPE_BY_TYPENAME
    ];
  return (
    DECISION_QUESTION_TYPES.find((questionType) => questionType.id === type)
      ?.label ?? null
  );
}

/**
 * The fields of a decision version that make up its definition. Also used to
 * compare two versions.
 */
export const decisionDefinitionCardFragment = graphql`
  fragment DecisionDefinitionCard_version on DecisionVersion {
    inputs {
      name
      description
      jsonSchema
    }
    state {
      __typename
      ... on DecisionObjectState {
        object
      }
      ... on DecisionTextState {
        template
        templateFormat
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
    modelName
    # Aliased: this fragment shares a node with prompt version fragments,
    # whose modelProvider has a different type
    decisionModelProvider: modelProvider
    customProvider {
      id
      name
    }
  }
`;

/**
 * The definition of a decision version as text, for copying and comparing
 */
export function decisionDefinitionToText(
  definition: DecisionDefinitionCard_version$data
): string {
  return decisionVersionToText({
    ...definition,
    modelProvider: definition.decisionModelProvider,
  });
}

/**
 * The definition of a decision version: its inputs, the state it is asked
 * about, and its questions. The counterpart of a prompt's template card.
 */
export function DecisionDefinitionCard({
  decisionVersion,
  title = "Decision",
  extra,
  children,
}: {
  decisionVersion: DecisionDefinitionCard_version$key;
  title?: string;
  /**
   * Controls rendered in the card header next to the copy button
   */
  extra?: ReactNode;
  /**
   * Replaces the definition body, e.g. with a diff
   */
  children?: ReactNode;
}) {
  const definition = useFragment<DecisionDefinitionCard_version$key>(
    decisionDefinitionCardFragment,
    decisionVersion
  );
  return (
    <Card
      title={title}
      collapsible
      data-testid="decision-definition-card"
      extra={
        <Flex gap="size-100" alignItems="center">
          {extra}
          <CopyToClipboardButton
            text={decisionDefinitionToText(definition)}
            aria-label="Copy decision definition"
          />
        </Flex>
      }
    >
      {children ?? <DecisionDefinition definition={definition} />}
    </Card>
  );
}

function DecisionDefinition({
  definition,
}: {
  definition: DecisionDefinitionCard_version$data;
}) {
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        <section>
          <Heading level={3}>Inputs</Heading>
          {definition.inputs.map((input) => (
            <View key={input.name} paddingY="size-100">
              <Flex direction="column" gap="size-50">
                <Text weight="heavy">{input.name}</Text>
                {input.description ? <Text>{input.description}</Text> : null}
                {input.jsonSchema ? (
                  <JSONBlock
                    value={JSON.stringify(input.jsonSchema, null, 2)}
                  />
                ) : null}
              </Flex>
            </View>
          ))}
        </section>
        <section>
          <Heading level={3}>State</Heading>
          {definition.state.__typename === "DecisionTextState" ? (
            <>
              <Text color="text-700">{definition.state.templateFormat}</Text>
              <pre css={preCSS}>{definition.state.template}</pre>
            </>
          ) : definition.state.__typename === "DecisionInputState" ? (
            <Text>Use input: {definition.state.input}</Text>
          ) : (
            <Text>Send the declared inputs as a JSON object.</Text>
          )}
        </section>
        <section>
          <Heading level={3}>Questions</Heading>
          <Flex direction="column" gap="size-200">
            {definition.questions.map((question, index) => {
              if (question.__typename === "%other") return null;
              return (
                <Flex key={index} direction="column" gap="size-100">
                  <Heading level={4}>{question.name}</Heading>
                  <Text color="text-700">
                    {getQuestionTypeLabel(question.__typename)}
                  </Text>
                  <Text>{question.instructions}</Text>
                  {question.__typename === "DecisionPredicateQuestion" ? (
                    <>
                      {question.criteria?.true ? (
                        <Text>True: {question.criteria.true}</Text>
                      ) : null}
                      {question.criteria?.false ? (
                        <Text>False: {question.criteria.false}</Text>
                      ) : null}
                    </>
                  ) : question.__typename === "DecisionChoiceQuestion" ? (
                    <ul>
                      {question.choices.map((choice) => (
                        <li key={choice.value}>
                          {choice.value}
                          {choice.description ? ` — ${choice.description}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : question.__typename === "DecisionScaleQuestion" ? (
                    // Levels run low to high; their labels already
                    // number them, so the list adds no markers.
                    <ol css={levelListCSS}>
                      {question.levels.map((level, levelIndex) => (
                        <li key={levelIndex}>
                          {level.label}
                          {level.description ? ` — ${level.description}` : ""}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </Flex>
              );
            })}
          </Flex>
        </section>
      </Flex>
    </View>
  );
}
