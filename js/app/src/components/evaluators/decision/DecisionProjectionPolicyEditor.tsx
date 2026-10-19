import { css } from "@emotion/react";
import { Fragment } from "react";

import {
  Button,
  FieldError,
  Flex,
  Input,
  Label,
  ListBox,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Switch,
  Text,
} from "@phoenix/components";
import { optimizationDirectionOptions } from "@phoenix/components/evaluators/OptimizationDirectionField";

import type {
  DecisionOptimizationDirection,
  DecisionPolicyValidation,
  DecisionProjectionPolicyValue,
  DecisionQuestionDefinition,
  DecisionQuestionProjectionValue,
} from "./decisionPolicyUtils";
import {
  getQuestionProjectionName,
  normalizePolicy,
  questionProjectionsEqual,
  validatePolicy,
} from "./decisionPolicyUtils";

export type DecisionProjectionPolicyEditorProps = {
  /** The decision version's questions, in declared order. */
  questions: readonly DecisionQuestionDefinition[];
  /**
   * Without `inheritedPolicy`: the full policy being edited; missing questions
   * show defaults. With `inheritedPolicy`: the sparse override, where each
   * listed question replaces the inherited settings.
   */
  value: DecisionProjectionPolicyValue | null | undefined;
  /**
   * Receives the next value. Without `inheritedPolicy` it lists every question
   * in declared order. With it, it lists only the overridden questions, and an
   * empty list means inherit everything (a binding stores that as null).
   */
  onChange: (value: DecisionProjectionPolicyValue) => void;
  /**
   * The judge's own policy, for a dataset binding. Switches the editor to
   * override mode: every question shows the inherited values until the user
   * overrides it, and an overridden question can be reset to inherited.
   */
  inheritedPolicy?: DecisionProjectionPolicyValue | null;
  isDisabled?: boolean;
};

const directionLabel = (direction: DecisionOptimizationDirection) =>
  optimizationDirectionOptions.find((option) => option.value === direction)
    ?.label ?? direction;

const listCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: 0;
  padding: 0;
  list-style: none;
`;
const scoreGridCSS = css`
  display: grid;
  grid-template-columns: minmax(0, max-content) 7ch;
  align-items: center;
  column-gap: var(--global-dimension-size-200);
  row-gap: var(--global-dimension-size-50);
`;
// Thresholds and directions are short values; keep them from stretching across the form.
const compactFieldCSS = css`
  width: 16ch;
  flex: none;
`;
const questionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

/**
 * Edits how a decision judge's answers become annotation scores: a threshold
 * per predicate, a score per declared choice, a label switch per scale, and an
 * optimization direction for each.
 *
 * Controlled. Pass `inheritedPolicy` to edit a dataset binding's sparse
 * override of the judge's policy.
 */
export function DecisionProjectionPolicyEditor({
  questions,
  value,
  onChange,
  inheritedPolicy,
  isDisabled,
}: DecisionProjectionPolicyEditorProps) {
  const isOverrideMode = inheritedPolicy !== undefined;
  const base = normalizePolicy(questions, inheritedPolicy);
  const override = new Map(
    (value?.questions ?? []).map((question) => [
      getQuestionProjectionName(question),
      question,
    ])
  );
  const effective = isOverrideMode
    ? {
        questions: base.questions.map(
          (question) =>
            override.get(getQuestionProjectionName(question)) ?? question
        ),
      }
    : normalizePolicy(questions, value);
  const validation = validatePolicy(effective);

  const emit = (next: DecisionQuestionProjectionValue[]) => {
    onChange({ questions: next });
  };
  const updateQuestion = (
    index: number,
    updated: DecisionQuestionProjectionValue
  ) => {
    if (!isOverrideMode) {
      emit(effective.questions.map((q, i) => (i === index ? updated : q)));
      return;
    }
    const name = getQuestionProjectionName(updated);
    // Keep the override only while it differs from the inherited settings.
    const isSameAsInherited = questionProjectionsEqual(
      base.questions[index],
      updated
    );
    emit(
      base.questions.flatMap((question, i) => {
        const questionName = getQuestionProjectionName(question);
        if (questionName === name) return isSameAsInherited ? [] : [updated];
        const existing = override.get(questionName);
        return existing && i !== index ? [existing] : [];
      })
    );
  };
  const resetQuestion = (name: string) => {
    emit(
      (value?.questions ?? []).filter(
        (question) => getQuestionProjectionName(question) !== name
      )
    );
  };

  return (
    <ul css={listCSS} data-testid="decision-projection-policy-editor">
      {effective.questions.map((question, index) => {
        const name = getQuestionProjectionName(question);
        const definition = questions[index];
        const isOverridden = isOverrideMode && override.has(name);
        return (
          <li
            key={name}
            css={questionCSS}
            data-testid={`decision-policy-question-${name}`}
            data-overridden={isOverrideMode ? isOverridden : undefined}
          >
            <Flex
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap="size-100"
              wrap
            >
              <Flex direction="column" gap="size-25">
                <Text weight="heavy">{name}</Text>
                <Text size="XS" color="text-700">
                  {definition.type === "predicate"
                    ? "Predicate"
                    : definition.type === "choice"
                      ? "Choice"
                      : "Scale"}
                  {isOverrideMode
                    ? ` · ${isOverridden ? "Overridden for this dataset" : "Inherited from the judge"}`
                    : ""}
                </Text>
              </Flex>
              {isOverridden ? (
                <Button
                  size="S"
                  isDisabled={isDisabled}
                  onPress={() => resetQuestion(name)}
                  data-testid={`decision-policy-reset-${name}-button`}
                >
                  Reset to inherited
                </Button>
              ) : null}
            </Flex>
            <QuestionFields
              definition={definition}
              question={question}
              errors={validation[name]}
              isDisabled={isDisabled}
              onChange={(updated) => updateQuestion(index, updated)}
            />
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
  question: DecisionQuestionProjectionValue;
  errors: DecisionPolicyValidation[string] | undefined;
  isDisabled?: boolean;
  onChange: (question: DecisionQuestionProjectionValue) => void;
}) {
  const direction = (
    settings: { optimizationDirection: DecisionOptimizationDirection },
    name: string
  ) => (
    <DirectionSelect
      name={name}
      value={settings.optimizationDirection}
      isDisabled={isDisabled}
      onChange={(optimizationDirection) =>
        onChange(
          withDirection(question, optimizationDirection) as typeof question
        )
      }
    />
  );

  if ("predicate" in question) {
    const { predicate } = question;
    return (
      <Flex direction="row" gap="size-200" alignItems="start" wrap>
        <div css={compactFieldCSS}>
          <NumberField
            size="S"
            aria-label={`${predicate.name} threshold`}
            value={predicate.threshold}
            isDisabled={isDisabled}
            isInvalid={Boolean(errors?.length)}
            onChange={(threshold) =>
              onChange({ predicate: { ...predicate, threshold } })
            }
          >
            <Label>Threshold</Label>
            <Input
              data-testid={`decision-policy-${predicate.name}-threshold`}
            />
            <Text slot="description">
              True at or above this probability (0–1).
            </Text>
            <FieldError>{errors?.join(" ")}</FieldError>
          </NumberField>
        </div>
        {direction(predicate, predicate.name)}
      </Flex>
    );
  }

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
          {definition.choices.map((value) => (
            <Fragment key={value}>
              <Text size="S" title={value}>
                {value}
              </Text>
              <NumberField
                size="S"
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
        {direction(choice, choice.name)}
      </Flex>
    );
  }

  if ("scale" in question) {
    const { scale } = question;
    return (
      <Flex direction="row" gap="size-200" alignItems="end" wrap>
        <Switch
          isSelected={scale.includeLabel}
          isDisabled={isDisabled}
          onChange={(includeLabel) =>
            onChange({ scale: { ...scale, includeLabel } })
          }
          data-testid={`decision-policy-${scale.name}-include-label-switch`}
        >
          Also label with the most probable level
        </Switch>
        {direction(scale, scale.name)}
      </Flex>
    );
  }
  return null;
}

function withDirection(
  question: DecisionQuestionProjectionValue,
  optimizationDirection: DecisionOptimizationDirection
): DecisionQuestionProjectionValue {
  if ("predicate" in question) {
    return { predicate: { ...question.predicate, optimizationDirection } };
  }
  if ("choice" in question) {
    return { choice: { ...question.choice, optimizationDirection } };
  }
  return { scale: { ...question.scale, optimizationDirection } };
}

function DirectionSelect({
  name,
  value,
  isDisabled,
  onChange,
}: {
  name: string;
  value: DecisionOptimizationDirection;
  isDisabled?: boolean;
  onChange: (value: DecisionOptimizationDirection) => void;
}) {
  return (
    <div css={compactFieldCSS}>
      <Select
        size="S"
        value={value}
        isDisabled={isDisabled}
        aria-label={`${name} optimization direction`}
        onChange={(key) => onChange(key as DecisionOptimizationDirection)}
        data-testid={`decision-policy-${name}-direction-picker`}
      >
        <Label>Optimization direction</Label>
        <Button>
          <SelectValue>{directionLabel(value)}</SelectValue>
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            {optimizationDirectionOptions.map((option) => (
              <SelectItem key={option.value} id={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
    </div>
  );
}
