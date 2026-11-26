import { css } from "@emotion/react";
import { Fragment } from "react";

import {
  FieldError,
  Flex,
  Input,
  Label,
  NumberField,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import {
  OptimizationDirectionSelect,
  PREDICATE_OPTIMIZATION_DIRECTION_DESCRIPTION,
  PREDICATE_OPTIMIZATION_DIRECTION_OPTIONS,
} from "@phoenix/components/evaluators/OptimizationDirectionField";

import type {
  DecisionOptimizationDirection,
  DecisionPolicyValidation,
  DecisionPredicateScoringValue,
  DecisionScoringPolicyValue,
  DecisionQuestionDefinition,
  DecisionQuestionScoringValue,
} from "./decisionPolicyUtils";
import {
  getQuestionScoringName,
  normalizePolicy,
  validatePolicy,
} from "./decisionPolicyUtils";

export type DecisionScoringPolicyEditorProps = {
  /** The decision version's questions, in declared order. */
  questions: readonly DecisionQuestionDefinition[];
  /** The policy being edited; missing questions show defaults. */
  value: DecisionScoringPolicyValue | null | undefined;
  /** Receives the next value, listing every question in declared order. */
  onChange: (value: DecisionScoringPolicyValue) => void;
  isDisabled?: boolean;
};

const KIND_LABELS: Record<DecisionQuestionDefinition["type"], string> = {
  predicate: "Yes / No question",
  choice: "Choice question",
  scale: "Scale question",
};

const listCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: 0;
  padding: 0;
  list-style: none;
`;
const questionCSS = css`
  padding: var(--global-dimension-size-200);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;
const scoreGridCSS = css`
  width: 100%;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--global-dimension-size-100);
  align-items: start;
`;
const fullWidthCSS = css`
  width: 100%;
`;

/**
 * Edits how a decision evaluator's answers become annotation scores. Each
 * question gets the card the LLM evaluator's annotation editor draws: the
 * question and its optimization direction on top, then a threshold per
 * predicate, a score per declared choice, or a label switch per scale.
 *
 * Controlled.
 */
export function DecisionScoringPolicyEditor({
  questions,
  value,
  onChange,
  isDisabled,
}: DecisionScoringPolicyEditorProps) {
  const effective = normalizePolicy(questions, value);
  const validation = validatePolicy(effective);

  const updateQuestion = (
    index: number,
    updated: DecisionQuestionScoringValue
  ) => {
    onChange({
      questions: effective.questions.map((q, i) => (i === index ? updated : q)),
    });
  };

  return (
    <ul css={listCSS} data-testid="decision-scoring-policy-editor">
      {effective.questions.map((question, index) => {
        const name = getQuestionScoringName(question);
        const definition = questions[index];
        return (
          <li
            key={name}
            css={questionCSS}
            data-testid={`decision-policy-question-${name}`}
          >
            <Flex direction="column" gap="size-200">
              <Flex direction="row" gap="size-200" alignItems="start">
                <TextField isDisabled value={name}>
                  <Label>{KIND_LABELS[definition.type]}</Label>
                  <Input />
                </TextField>
                <OptimizationDirectionSelect
                  data-testid={`decision-policy-${name}-direction-picker`}
                  aria-label={`${name} optimization direction`}
                  value={getDirection(question)}
                  {...("predicate" in question
                    ? {
                        options: PREDICATE_OPTIMIZATION_DIRECTION_OPTIONS,
                        description:
                          PREDICATE_OPTIMIZATION_DIRECTION_DESCRIPTION,
                      }
                    : {})}
                  isDisabled={isDisabled}
                  onChange={(optimizationDirection) =>
                    updateQuestion(
                      index,
                      withDirection(question, optimizationDirection)
                    )
                  }
                />
                {"predicate" in question ? (
                  <ThresholdField
                    predicate={question.predicate}
                    errors={validation[name]}
                    isDisabled={isDisabled}
                    onChange={(predicate) =>
                      updateQuestion(index, { predicate })
                    }
                  />
                ) : null}
              </Flex>
              {"predicate" in question ? null : (
                <QuestionFields
                  definition={definition}
                  question={question}
                  errors={validation[name]}
                  isDisabled={isDisabled}
                  onChange={(updated) => updateQuestion(index, updated)}
                />
              )}
            </Flex>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionFields({
  definition,
  question,
  errors,
  isDisabled,
  onChange,
}: {
  definition: DecisionQuestionDefinition;
  question: DecisionQuestionScoringValue;
  errors: DecisionPolicyValidation[string] | undefined;
  isDisabled?: boolean;
  onChange: (question: DecisionQuestionScoringValue) => void;
}) {
  if ("choice" in question && definition.type === "choice") {
    const { choice } = question;
    const scoreOf = (value: string) =>
      choice.scores.find((entry) => entry.choice === value)?.score;
    return (
      <Flex direction="column" gap="size-100">
        <div
          css={scoreGridCSS}
          role="group"
          aria-label={`${choice.name} scores`}
        >
          <Text size="XS" weight="heavy">
            Choice
          </Text>
          <Text size="XS" weight="heavy">
            Score
          </Text>
          {definition.choices.map((value) => (
            <Fragment key={value}>
              <TextField isDisabled value={value} aria-label={value}>
                <Input />
              </TextField>
              <NumberField
                css={fullWidthCSS}
                aria-label={`${choice.name} score for ${value}`}
                value={scoreOf(value) ?? NaN}
                isDisabled={isDisabled}
                isInvalid={
                  scoreOf(value) !== undefined &&
                  !Number.isFinite(scoreOf(value) as number)
                }
                onChange={(score) => {
                  const others = choice.scores.filter(
                    (entry) => entry.choice !== value
                  );
                  const next = Number.isNaN(score)
                    ? others
                    : [...others, { choice: value, score }];
                  onChange({
                    choice: {
                      ...choice,
                      scores: definition.choices.flatMap((declared) => {
                        const entry = next.find((e) => e.choice === declared);
                        return entry ? [entry] : [];
                      }),
                    },
                  });
                }}
              >
                <Input
                  placeholder="None"
                  // the css prop replaces the default input class; keep it
                  className="react-aria-Input"
                  css={fullWidthCSS}
                  data-testid={`decision-policy-${choice.name}-score-${value}`}
                />
              </NumberField>
            </Fragment>
          ))}
        </div>
        <Text size="XS" color="text-700">
          A choice left empty gets no score.
        </Text>
        {errors?.length ? (
          <Text color="danger" size="S" role="alert">
            {errors.join(" ")}
          </Text>
        ) : null}
      </Flex>
    );
  }

  if ("scale" in question) {
    const { scale } = question;
    return (
      <Switch
        isSelected={scale.includeLabel}
        isDisabled={isDisabled}
        onChange={(includeLabel) =>
          onChange({ scale: { ...scale, includeLabel } })
        }
        data-testid={`decision-policy-${scale.name}-include-label-switch`}
      >
        <Text>Also label with the most probable level</Text>
      </Switch>
    );
  }
  return null;
}

function ThresholdField({
  predicate,
  errors,
  isDisabled,
  onChange,
}: {
  predicate: DecisionPredicateScoringValue;
  errors: DecisionPolicyValidation[string] | undefined;
  isDisabled?: boolean;
  onChange: (predicate: DecisionPredicateScoringValue) => void;
}) {
  return (
    <NumberField
      aria-label={`${predicate.name} threshold`}
      value={predicate.threshold}
      isDisabled={isDisabled}
      isInvalid={Boolean(errors?.length)}
      onChange={(threshold) => onChange({ ...predicate, threshold })}
    >
      <Label>Threshold</Label>
      <Input data-testid={`decision-policy-${predicate.name}-threshold`} />
      <Text slot="description">True at or above this probability (0–1).</Text>
      <FieldError>{errors?.join(" ")}</FieldError>
    </NumberField>
  );
}

function getDirection(
  question: DecisionQuestionScoringValue
): DecisionOptimizationDirection {
  if ("predicate" in question) return question.predicate.optimizationDirection;
  if ("choice" in question) return question.choice.optimizationDirection;
  return question.scale.optimizationDirection;
}

function withDirection(
  question: DecisionQuestionScoringValue,
  optimizationDirection: DecisionOptimizationDirection
): DecisionQuestionScoringValue {
  if ("predicate" in question) {
    return { predicate: { ...question.predicate, optimizationDirection } };
  }
  if ("choice" in question) {
    return { choice: { ...question.choice, optimizationDirection } };
  }
  return { scale: { ...question.scale, optimizationDirection } };
}
