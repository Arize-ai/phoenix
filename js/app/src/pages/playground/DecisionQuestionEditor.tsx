import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Alert,
  Button,
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  DecisionQuestionDraft,
  DecisionQuestionType,
} from "@phoenix/store/playground/types";

import {
  createChoiceOption,
  createDecisionQuestion,
  createScoreLevel,
  DECISION_QUESTION_TYPES,
  type DecisionQuestionErrors,
  MAX_CHOICE_OPTIONS,
  MAX_SCORE_LEVELS,
  MIN_CHOICE_OPTIONS,
  MIN_SCORE_LEVELS,
  toSystemOneQuestion,
} from "./decisionUtils";

const hiddenLabelCSS = css`
  .field__label {
    display: none;
  }
`;

const nameFieldCSS = css`
  width: 14em;
  min-width: 6em;
`;

const criteriaCSS = css`
  border-top: 1px solid var(--global-card-border-color);
`;

const optionRowCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto;
  gap: var(--global-dimension-size-100);
  align-items: start;
`;

const levelRowCSS = css`
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr) auto;
  gap: var(--global-dimension-size-100);
  align-items: center;
`;

const twoUpCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
`;

const listCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

type Props = {
  question: DecisionQuestionDraft;
  index: number;
  errors: DecisionQuestionErrors | undefined;
  isDisabled: boolean;
  canRemove: boolean;
  templateFormat: TemplateFormat;
  /** Bumped when the request is replaced from outside (import). */
  revision: number;
  onChange: (patch: Partial<DecisionQuestionDraft>) => void;
  onRemove: () => void;
};

function isQuestionType(key: unknown): key is DecisionQuestionType {
  return key === "choice" || key === "noul" || key === "score";
}

/**
 * One question, laid out like a chat message card: the type picker stands in
 * for the role, the name sits beside it, and the instructions are the body.
 * Criteria for the type follow under a rule, so nobody hand-writes the
 * System One or OpenAI JSON for options or levels.
 */
export function DecisionQuestionEditor({
  question,
  index,
  errors,
  isDisabled,
  canRemove,
  templateFormat,
  revision,
  onChange,
  onRemove,
}: Props) {
  const label = question.name.trim() || `question ${index + 1}`;
  const copyText = JSON.stringify(
    { [question.name.trim() || "question"]: toSystemOneQuestion({ question }) },
    null,
    2
  );
  const headerError = errors?.name
    ? errors.name === "Required"
      ? "Give the question a name; it keys the answer."
      : "Another question already has this name."
    : null;
  return (
    <Card
      collapsible
      interactiveTitle
      collapseButtonLabel={`${label} question`}
      testId={`decision-question-${index}`}
      headerContent={
        <CardCollapsedPreview>{question.instructions}</CardCollapsedPreview>
      }
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          <Select
            size="S"
            css={hiddenLabelCSS}
            aria-label="Question type"
            selectedKey={question.type}
            isDisabled={isDisabled}
            onSelectionChange={(key) => {
              if (!isQuestionType(key) || key === question.type) return;
              // Seed criteria for the new type so the card never opens on a
              // validation error.
              const seeded = createDecisionQuestion({ type: key });
              onChange({
                type: key,
                choices: question.choices.length
                  ? question.choices
                  : seeded.choices,
                levels: question.levels.length
                  ? question.levels
                  : seeded.levels,
              });
            }}
          >
            <Button size="S">
              <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
              <SelectChevronUpDownIcon />
            </Button>
            <Popover placement="bottom start" offset={4}>
              <ListBox>
                {DECISION_QUESTION_TYPES.map((questionType) => (
                  <SelectItem
                    key={questionType.id}
                    id={questionType.id}
                    textValue={questionType.label}
                  >
                    <Flex direction="column">
                      <Text>{questionType.label}</Text>
                      <Text size="XS" color="text-700">
                        {questionType.description}
                      </Text>
                    </Flex>
                  </SelectItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
          <TextField
            size="S"
            css={nameFieldCSS}
            aria-label="Question name"
            value={question.name}
            onChange={(name) => onChange({ name })}
            isDisabled={isDisabled}
            isInvalid={!!errors?.name}
          >
            <Input placeholder="name" />
          </TextField>
        </Flex>
      }
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={copyText} />
          <Button
            size="S"
            aria-label={`Delete ${label}`}
            leadingVisual={<Icon svg={<Icons.Trash />} />}
            isDisabled={isDisabled || !canRemove}
            onPress={onRemove}
          />
        </Flex>
      }
    >
      {headerError ? (
        <Alert variant="danger" banner>
          {headerError}
        </Alert>
      ) : null}
      {errors?.instructions ? (
        <Alert variant="danger" banner>
          Say what the model should decide.
        </Alert>
      ) : null}
      <TemplateEditorWrap readOnly={isDisabled}>
        <TemplateEditor
          // Uncontrolled: remount on format change or import.
          key={`${question.id}-${templateFormat}-${revision}`}
          aria-label={`Instructions for ${label}`}
          templateFormat={templateFormat}
          defaultValue={question.instructions}
          placeholder="What should the model decide about the state?"
          onChange={(instructions) => onChange({ instructions })}
          readOnly={isDisabled}
        />
      </TemplateEditorWrap>
      <div css={criteriaCSS}>
        <View paddingX="size-200" paddingY="size-150">
          {question.type === "choice" ? (
            <ChoiceCriteriaEditor
              question={question}
              errors={errors}
              isDisabled={isDisabled}
              onChange={onChange}
            />
          ) : question.type === "score" ? (
            <ScoreCriteriaEditor
              question={question}
              errors={errors}
              isDisabled={isDisabled}
              onChange={onChange}
            />
          ) : (
            <NoulCriteriaEditor
              question={question}
              isDisabled={isDisabled}
              onChange={onChange}
            />
          )}
        </View>
      </div>
    </Card>
  );
}

type CriteriaProps = Pick<
  Props,
  "question" | "errors" | "isDisabled" | "onChange"
>;

function CriteriaHeading({
  title,
  action,
}: {
  title: string;
  action: ReactNode;
}) {
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap="size-100"
    >
      <Text size="S" weight="heavy" color="text-700">
        {title}
      </Text>
      {action}
    </Flex>
  );
}

function ChoiceCriteriaEditor({
  question,
  errors,
  isDisabled,
  onChange,
}: CriteriaProps) {
  const updateOption = (
    optionId: string,
    patch: { value?: string; description?: string }
  ) =>
    onChange({
      choices: question.choices.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      ),
    });
  const canAddOption = question.choices.length < MAX_CHOICE_OPTIONS;
  const canRemoveOption = question.choices.length > MIN_CHOICE_OPTIONS;
  return (
    <Flex direction="column" gap="size-100">
      <CriteriaHeading
        title="Options"
        action={
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isDisabled || !canAddOption}
            onPress={() =>
              onChange({
                choices: [...question.choices, createChoiceOption()],
              })
            }
          >
            Option
          </Button>
        }
      />
      {errors?.choices ? (
        <Alert variant="danger">{errors.choices}</Alert>
      ) : null}
      <ul css={listCSS} aria-label="Choice options">
        {question.choices.map((option, optionIndex) => {
          const optionError = errors?.choiceOptions?.[option.id];
          return (
            <li key={option.id} css={optionRowCSS}>
              <TextField
                size="S"
                aria-label={`Option ${optionIndex + 1} value`}
                value={option.value}
                onChange={(value) => updateOption(option.id, { value })}
                isDisabled={isDisabled}
                isInvalid={!!optionError}
              >
                <Input placeholder="value" />
                {optionError ? <FieldError>{optionError}</FieldError> : null}
              </TextField>
              <TextField
                size="S"
                aria-label={`Option ${optionIndex + 1} description`}
                value={option.description}
                onChange={(description) =>
                  updateOption(option.id, { description })
                }
                isDisabled={isDisabled}
              >
                <Input placeholder="when to pick this (optional)" />
              </TextField>
              <Button
                size="S"
                aria-label={`Remove option ${optionIndex + 1}`}
                leadingVisual={<Icon svg={<Icons.Trash />} />}
                isDisabled={isDisabled || !canRemoveOption}
                onPress={() =>
                  onChange({
                    choices: question.choices.filter(
                      (candidate) => candidate.id !== option.id
                    ),
                  })
                }
              />
            </li>
          );
        })}
      </ul>
    </Flex>
  );
}

function ScoreCriteriaEditor({
  question,
  errors,
  isDisabled,
  onChange,
}: CriteriaProps) {
  const moveLevel = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= question.levels.length) return;
    const levels = [...question.levels];
    const [level] = levels.splice(fromIndex, 1);
    levels.splice(toIndex, 0, level);
    onChange({ levels });
  };
  const canAddLevel = question.levels.length < MAX_SCORE_LEVELS;
  const canRemoveLevel = question.levels.length > MIN_SCORE_LEVELS;
  return (
    <Flex direction="column" gap="size-100">
      <CriteriaHeading
        title="Levels, low to high"
        action={
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isDisabled || !canAddLevel}
            onPress={() =>
              onChange({ levels: [...question.levels, createScoreLevel()] })
            }
          >
            Level
          </Button>
        }
      />
      {errors?.levels ? <Alert variant="danger">{errors.levels}</Alert> : null}
      <ol css={listCSS} aria-label="Score levels">
        {question.levels.map((level, levelIndex) => (
          <li key={level.id} css={levelRowCSS}>
            <Text size="S" color="text-700" fontFamily="mono">
              {levelIndex}
            </Text>
            <TextField
              size="S"
              aria-label={`Level ${levelIndex} description`}
              value={level.description}
              onChange={(description) =>
                onChange({
                  levels: question.levels.map((candidate) =>
                    candidate.id === level.id
                      ? { ...candidate, description }
                      : candidate
                  ),
                })
              }
              isDisabled={isDisabled}
              isInvalid={!!errors?.levels && !level.description.trim()}
            >
              <Input
                placeholder={levelIndex === 0 ? "e.g. Low" : "e.g. High"}
              />
            </TextField>
            <Flex direction="row" gap="size-50">
              <Button
                size="S"
                aria-label={`Move level ${levelIndex} up`}
                leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
                isDisabled={isDisabled || levelIndex === 0}
                onPress={() => moveLevel(levelIndex, levelIndex - 1)}
              />
              <Button
                size="S"
                aria-label={`Move level ${levelIndex} down`}
                leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
                isDisabled={
                  isDisabled || levelIndex === question.levels.length - 1
                }
                onPress={() => moveLevel(levelIndex, levelIndex + 1)}
              />
              <Button
                size="S"
                aria-label={`Remove level ${levelIndex}`}
                leadingVisual={<Icon svg={<Icons.Trash />} />}
                isDisabled={isDisabled || !canRemoveLevel}
                onPress={() =>
                  onChange({
                    levels: question.levels.filter(
                      (candidate) => candidate.id !== level.id
                    ),
                  })
                }
              />
            </Flex>
          </li>
        ))}
      </ol>
    </Flex>
  );
}

function NoulCriteriaEditor({
  question,
  isDisabled,
  onChange,
}: Omit<CriteriaProps, "errors">) {
  return (
    <Flex direction="column" gap="size-100">
      <CriteriaHeading title="Criteria (optional)" action={null} />
      <div css={twoUpCSS}>
        <TextField
          size="S"
          aria-label="True when"
          value={question.noul.trueDescription}
          onChange={(trueDescription) =>
            onChange({ noul: { ...question.noul, trueDescription } })
          }
          isDisabled={isDisabled}
        >
          <Input placeholder="true when…" />
        </TextField>
        <TextField
          size="S"
          aria-label="False when"
          value={question.noul.falseDescription}
          onChange={(falseDescription) =>
            onChange({ noul: { ...question.noul, falseDescription } })
          }
          isDisabled={isDisabled}
        >
          <Input placeholder="false when…" />
        </TextField>
      </div>
    </Flex>
  );
}
