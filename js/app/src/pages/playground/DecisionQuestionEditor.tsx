import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
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
} from "./decisionUtils";

const fieldRowCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  align-items: start;
`;

const criteriaRowCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto;
  gap: var(--global-dimension-size-100);
  align-items: end;
`;

const levelRowCSS = css`
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr) auto auto auto;
  gap: var(--global-dimension-size-75);
  align-items: center;
`;

const listCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-75);
`;

type Props = {
  question: DecisionQuestionDraft;
  index: number;
  errors: DecisionQuestionErrors | undefined;
  isDisabled: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<DecisionQuestionDraft>) => void;
  onRemove: () => void;
};

function isQuestionType(key: unknown): key is DecisionQuestionType {
  return key === "choice" || key === "noul" || key === "score";
}

/**
 * One typed question as a card, following the per-tool card in the chat
 * playground. The criteria editor matches the question type, so the user
 * never hand-writes the System One or OpenAI JSON for options or levels.
 */
export function DecisionQuestionEditor({
  question,
  index,
  errors,
  isDisabled,
  canRemove,
  onChange,
  onRemove,
}: Props) {
  const typeInfo = DECISION_QUESTION_TYPES.find((t) => t.id === question.type);
  const title = question.name.trim() || `Question ${index + 1}`;
  return (
    <Card
      collapsible
      defaultOpen
      testId={`decision-question-${index}`}
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text>{title}</Text>
          <Text size="S" color="text-700">
            {typeInfo?.label}
          </Text>
        </Flex>
      }
      extra={
        <Button
          size="S"
          aria-label={`Remove question ${index + 1}`}
          leadingVisual={<Icon svg={<Icons.Trash />} />}
          isDisabled={isDisabled || !canRemove}
          onPress={onRemove}
        />
      }
    >
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <div css={fieldRowCSS}>
            <TextField
              size="S"
              value={question.name}
              onChange={(name) => onChange({ name })}
              isDisabled={isDisabled}
              isInvalid={!!errors?.name}
              isRequired
            >
              <Label>Name</Label>
              <Input placeholder="e.g. department" />
              {errors?.name ? (
                <FieldError>{errors.name}</FieldError>
              ) : (
                <Text slot="description">Returned with the answer.</Text>
              )}
            </TextField>
            <Select
              size="S"
              selectedKey={question.type}
              onSelectionChange={(key) => {
                if (!isQuestionType(key) || key === question.type) return;
                // Seed empty criteria for the new type so the editor never
                // opens on a validation error.
                const fresh = createDecisionQuestion(key);
                onChange({
                  type: key,
                  choices: question.choices.length
                    ? question.choices
                    : fresh.choices,
                  levels: question.levels.length
                    ? question.levels
                    : fresh.levels,
                });
              }}
              isDisabled={isDisabled}
            >
              <Label>Type</Label>
              <Button size="S">
                <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
                <SelectChevronUpDownIcon />
              </Button>
              <Text slot="description">{typeInfo?.description}</Text>
              <Popover>
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
          </div>
          <TextField
            size="S"
            value={question.instructions}
            onChange={(instructions) => onChange({ instructions })}
            isDisabled={isDisabled}
            isInvalid={!!errors?.instructions}
            isRequired
          >
            <Label>Instructions</Label>
            <TextArea rows={2} placeholder="What should the model decide?" />
            {errors?.instructions ? (
              <FieldError>{errors.instructions}</FieldError>
            ) : null}
          </TextField>
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
        </Flex>
      </View>
    </Card>
  );
}

type CriteriaProps = Pick<
  Props,
  "question" | "errors" | "isDisabled" | "onChange"
>;

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Flex direction="column" gap="size-25">
      <Text size="S" weight="heavy">
        {title}
      </Text>
      <Text size="XS" color="text-700">
        {description}
      </Text>
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
      <SectionHeading
        title="Options"
        description="The model picks one and returns a probability for each. Add an “other” option when the list may not cover every input."
      />
      {errors?.choices ? (
        <Alert variant="danger">{errors.choices}</Alert>
      ) : null}
      <ul css={listCSS} aria-label="Choice options">
        {question.choices.map((option, i) => {
          const optionError = errors?.choiceOptions?.[option.id];
          return (
            <li key={option.id} css={criteriaRowCSS}>
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
                <Input placeholder="description (optional)" />
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
      <div>
        <Button
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          isDisabled={isDisabled || question.choices.length >= 255}
          onPress={() =>
            onChange({ choices: [...question.choices, createChoiceOption()] })
          }
        >
          Add option
        </Button>
      </div>
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
      <SectionHeading
        title="Levels, lowest to highest"
        description="2 to 10 ordered levels. The score is a probability-weighted position on this scale."
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
          </li>
        ))}
      </ol>
      <div>
        <Button
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          isDisabled={isDisabled || question.levels.length >= 10}
          onPress={() =>
            onChange({ levels: [...question.levels, createScoreLevel()] })
          }
        >
          Add level
        </Button>
      </div>
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
      <SectionHeading
        title="Criteria (optional)"
        description="Describe what makes the answer true or false. OpenAI calls this question type a predicate."
      />
      <div css={fieldRowCSS}>
        <TextField
          size="S"
          value={question.noul.trueDescription}
          onChange={(trueDescription) =>
            onChange({ noul: { ...question.noul, trueDescription } })
          }
          isDisabled={isDisabled}
        >
          <Label>True when</Label>
          <Input placeholder="e.g. the customer asks for a refund" />
        </TextField>
        <TextField
          size="S"
          value={question.noul.falseDescription}
          onChange={(falseDescription) =>
            onChange({ noul: { ...question.noul, falseDescription } })
          }
          isDisabled={isDisabled}
        >
          <Label>False when</Label>
          <Input placeholder="e.g. no money is involved" />
        </TextField>
      </div>
    </Flex>
  );
}
