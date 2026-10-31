import { css } from "@emotion/react";

import { Flex, Heading, Text, Token, View } from "@phoenix/components";
import { DecisionJsonTemplateEditor } from "@phoenix/components/decision/DecisionJsonTemplateEditor";
import { toJsonTemplateText } from "@phoenix/components/decision/decisionTemplates";
import { evaluatorDetailsCardCSS } from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import {
  isTemplateFormat,
  type TemplateFormat,
} from "@phoenix/components/templateEditor/types";
import { DECISION_QUESTION_TYPES } from "@phoenix/pages/playground/decisionUtils";

import type { DecisionVersionDetails_definition$data } from "./__generated__/DecisionVersionDetails_definition.graphql";

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

const TEMPLATE_FORMAT_LABELS: Record<TemplateFormat, string> = {
  MUSTACHE: "Mustache",
  F_STRING: "F-String",
  NONE: "None",
};

const listCSS = css`
  list-style: none;
  margin: 0;
  padding: 0 0 0 var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={3}>{title}</Heading>
      {children}
    </Flex>
  );
}

/** A `Label: value` line, as the evaluator details pages write them. */
function LabeledText({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Text size="S">
      <Text weight="heavy">{label}</Text>
      {children != null && children !== "" ? <>: {children}</> : null}
    </Text>
  );
}

/**
 * The body of the "Decision Definition" card: the template format, the state
 * template the model is shown (its holes highlighted), the variables the
 * templates use, and the questions it answers, styled like the evaluator
 * details pages.
 */
export function DecisionDefinition({
  definition,
}: {
  definition: DecisionVersionDetails_definition$data;
}) {
  const { state, questions, variables } = definition;
  const templateFormat: TemplateFormat = isTemplateFormat(
    definition.templateFormat
  )
    ? definition.templateFormat
    : "MUSTACHE";
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-300">
        <Section title="State">
          <div css={evaluatorDetailsCardCSS}>
            <Flex direction="column" gap="size-100">
              <Flex alignItems="center" gap="size-100">
                <Text size="S" weight="heavy">
                  {state.__typename === "DecisionJsonState" ? "JSON" : "Text"}
                </Text>
                <Token size="S">{TEMPLATE_FORMAT_LABELS[templateFormat]}</Token>
              </Flex>
              <TemplateEditorWrap readOnly>
                {state.__typename === "DecisionJsonState" ? (
                  <DecisionJsonTemplateEditor
                    readOnly
                    aria-label="State template"
                    defaultValue={toJsonTemplateText({
                      template: state.json,
                      templateFormat,
                    })}
                    templateFormat={templateFormat}
                  />
                ) : (
                  <TemplateEditor
                    readOnly
                    height="100%"
                    aria-label="State template"
                    defaultValue={
                      state.__typename === "DecisionTextState" ? state.text : ""
                    }
                    templateFormat={templateFormat}
                  />
                )}
              </TemplateEditorWrap>
            </Flex>
          </div>
        </Section>
        <Section title="Variables">
          <div css={evaluatorDetailsCardCSS}>
            {variables.length === 0 ? (
              <Text size="S" color="text-700">
                {templateFormat === "NONE"
                  ? "None: the template format reads nothing as a variable."
                  : "None: every call sends the same state and questions."}
              </Text>
            ) : (
              <Flex direction="row" gap="size-100" wrap="wrap">
                {variables.map((name) => (
                  <Token key={name} size="S">
                    {name}
                  </Token>
                ))}
              </Flex>
            )}
          </div>
        </Section>
        <Section title="Questions">
          {questions.map((question, index) => {
            if (question.__typename === "%other") return null;
            const typeLabel = getQuestionTypeLabel(question.__typename);
            return (
              <div
                key={index}
                css={evaluatorDetailsCardCSS}
                data-testid="decision-question"
              >
                <Flex direction="column" gap="size-100">
                  <Flex alignItems="center" gap="size-100">
                    <Text weight="heavy">{question.name}</Text>
                    {typeLabel ? <Token size="S">{typeLabel}</Token> : null}
                  </Flex>
                  {question.instructions ? (
                    <Text size="S" color="text-700">
                      {question.instructions}
                    </Text>
                  ) : null}
                  {question.__typename === "DecisionPredicateQuestion" ? (
                    <>
                      {question.criteria?.true ? (
                        <LabeledText label="True">
                          {question.criteria.true}
                        </LabeledText>
                      ) : null}
                      {question.criteria?.false ? (
                        <LabeledText label="False">
                          {question.criteria.false}
                        </LabeledText>
                      ) : null}
                    </>
                  ) : question.__typename === "DecisionChoiceQuestion" ? (
                    <Flex direction="column" gap="size-50">
                      <Text size="S" weight="heavy">
                        Choices
                      </Text>
                      <ul css={listCSS}>
                        {question.choices.map((choice) => (
                          <li key={choice.value}>
                            <LabeledText label={choice.value}>
                              {choice.description}
                            </LabeledText>
                          </li>
                        ))}
                      </ul>
                    </Flex>
                  ) : question.__typename === "DecisionScaleQuestion" ? (
                    <Flex direction="column" gap="size-50">
                      <Text size="S" weight="heavy">
                        Levels
                      </Text>
                      {/* Levels run low to high; their labels already
                          number them, so the list adds no markers. */}
                      <ol css={listCSS}>
                        {question.levels.map((level, levelIndex) => (
                          <li key={levelIndex}>
                            <LabeledText label={level.label}>
                              {level.description}
                            </LabeledText>
                          </li>
                        ))}
                      </ol>
                    </Flex>
                  ) : null}
                </Flex>
              </div>
            );
          })}
        </Section>
      </Flex>
    </View>
  );
}
