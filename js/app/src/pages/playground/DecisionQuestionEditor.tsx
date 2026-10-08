import { css } from "@emotion/react";
import { useMemo } from "react";

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
  questionDraftToSystemOne,
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
  const copyText = useMemo(
    () =>
      JSON.stringify(
        {
          [question.name.trim() || "question"]:
            questionDraftToSystemOne(question),
        },
        null,
        2
      ),
    [question]
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
              const fresh = createDecisionQuestion(key);
              onChange({
                type: key,
                choices: question.choices.length
                  ? question.choices
                  : fresh.choices,
                levels: question.levels.length ? question.levels : fresh.levels,
              });
            }}
          >
            <Button size="S">
              <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
              <SelectChevronUpDownIcon />
            </Button>
            <Popover placement="bottom start" offset={4}>
              <ListBox>
                {DECISION_QUESTION_TYPES.map((t) => (
                  <SelectItem key={t.id} id={t.id} textValue={t.label}>
                    <Flex direction="column">
                      <Text>{t.label}</Text>
                      <Text size="XS" color="text-700">
                        {t.description}
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
  action: React.ReactNode;
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
    id: string,
    patch: { value?: string; description?: string }
  ) =>
    onChange({
      choices: question.choices.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    });
  return (
    <Flex direction="column" gap="size-100">
      <CriteriaHeading
        title="Options"
        action={
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isDisabled || question.choices.length >= 255}
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
        {question.choices.map((option, i) => {
          const optionError = errors?.choiceOptions?.[option.id];
          return (
            <li key={option.id} css={optionRowCSS}>
              <TextField
                size="S"
                aria-label={`Option ${i + 1} value`}
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
                aria-label={`Option ${i + 1} description`}
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
                aria-label={`Remove option ${i + 1}`}
                leadingVisual={<Icon svg={<Icons.Trash />} />}
                isDisabled={isDisabled || question.choices.length <= 2}
                onPress={() =>
                  onChange({
                    choices: question.choices.filter((c) => c.id !== option.id),
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
  const move = (from: number, to: number) => {
    if (to < 0 || to >= question.levels.length) return;
    const levels = [...question.levels];
    const [level] = levels.splice(from, 1);
    levels.splice(to, 0, level);
    onChange({ levels });
  };
  return (
    <Flex direction="column" gap="size-100">
      <CriteriaHeading
        title="Levels, low to high"
        action={
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isDisabled || question.levels.length >= 10}
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
        {question.levels.map((level, i) => (
          <li key={level.id} css={levelRowCSS}>
            <Text size="S" color="text-700" fontFamily="mono">
              {i}
            </Text>
            <TextField
              size="S"
              aria-label={`Level ${i} description`}
              value={level.description}
              onChange={(description) =>
                onChange({
                  levels: question.levels.map((l) =>
                    l.id === level.id ? { ...l, description } : l
                  ),
                })
              }
              isDisabled={isDisabled}
              isInvalid={!!errors?.levels && !level.description.trim()}
            >
              <Input placeholder={i === 0 ? "e.g. Low" : "e.g. High"} />
            </TextField>
            <Flex direction="row" gap="size-50">
              <Button
                size="S"
                aria-label={`Move level ${i} up`}
                leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
                isDisabled={isDisabled || i === 0}
                onPress={() => move(i, i - 1)}
              />
              <Button
                size="S"
                aria-label={`Move level ${i} down`}
                leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
                isDisabled={isDisabled || i === question.levels.length - 1}
                onPress={() => move(i, i + 1)}
              />
              <Button
                size="S"
                aria-label={`Remove level ${i}`}
                leadingVisual={<Icon svg={<Icons.Trash />} />}
                isDisabled={isDisabled || question.levels.length <= 2}
                onPress={() =>
                  onChange({
                    levels: question.levels.filter((l) => l.id !== level.id),
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
