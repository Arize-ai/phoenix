import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  IconButton,
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
  createScoreLevel,
  DECISION_QUESTION_TYPES,
  type DecisionQuestionErrors,
} from "./decisionUtils";

const rowCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto;
  gap: var(--global-dimension-size-100);
  align-items: start;
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

/**
 * One typed question. The criteria editor matches the question type, so the
 * user never hand-writes the System One or OpenAI JSON for options or levels.
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
  return (
    <View
      paddingY="size-200"
      borderBottomWidth="thin"
      borderBottomColor="default"
      data-testid={`decision-question-${index}`}
    >
      <Flex direction="column" gap="size-100">
        <div css={rowCSS}>
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
            {errors?.name ? <FieldError>{errors.name}</FieldError> : null}
          </TextField>
          <Select
            size="S"
            selectedKey={question.type}
            onSelectionChange={(key) => {
              if (key === "choice" || key === "noul" || key === "score") {
                onChange({ type: key as DecisionQuestionType });
              }
            }}
            isDisabled={isDisabled}
          >
            <Label>Type</Label>
            <Button size="S">
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
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
          <View paddingTop="size-300">
            <IconButton
              size="S"
              aria-label={`Remove question ${index + 1}`}
              isDisabled={isDisabled || !canRemove}
              onPress={onRemove}
            >
              <Icon svg={<Icons.Trash />} />
            </IconButton>
          </View>
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
          <TextArea rows={2} placeholder={typeInfo?.description} />
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
  );
}

type CriteriaProps = Pick<
  Props,
  "question" | "errors" | "isDisabled" | "onChange"
>;

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
    <Flex direction="column" gap="size-75">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
      >
        <Text size="S" weight="heavy">
          Options
        </Text>
        <Text size="XS" color="text-700">
          The model picks one and returns a probability for each. Add an
          &ldquo;other&rdquo; option when the list may not cover every input.
        </Text>
      </Flex>
      {errors?.choices ? (
        <Text size="XS" color="danger">
          {errors.choices}
        </Text>
      ) : null}
      <ul css={listCSS} aria-label="Choice options">
        {question.choices.map((option, i) => {
          const optionError = errors?.choiceOptions?.[option.id];
          return (
            <li key={option.id} css={rowCSS}>
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
              <IconButton
                size="S"
                aria-label={`Remove option ${i + 1}`}
                isDisabled={isDisabled || question.choices.length <= 2}
                onPress={() =>
                  onChange({
                    choices: question.choices.filter((c) => c.id !== option.id),
                  })
                }
              >
                <Icon svg={<Icons.Close />} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <div>
        <Button
          size="S"
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
    <Flex direction="column" gap="size-75">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
      >
        <Text size="S" weight="heavy">
          Levels, lowest to highest
        </Text>
        <Text size="XS" color="text-700">
          2 to 10 ordered levels. The score is a probability-weighted position
          on this scale.
        </Text>
      </Flex>
      {errors?.levels ? (
        <Text size="XS" color="danger">
          {errors.levels}
        </Text>
      ) : null}
      <ol css={listCSS} aria-label="Score levels">
        {question.levels.map((level, i) => (
          <li
            key={level.id}
            css={css`
              display: grid;
              grid-template-columns: auto minmax(0, 1fr) auto auto auto;
              gap: var(--global-dimension-size-75);
              align-items: center;
            `}
          >
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
            <IconButton
              size="S"
              aria-label={`Move level ${i} up`}
              isDisabled={isDisabled || i === 0}
              onPress={() => move(i, i - 1)}
            >
              <Icon svg={<Icons.ArrowUp />} />
            </IconButton>
            <IconButton
              size="S"
              aria-label={`Move level ${i} down`}
              isDisabled={isDisabled || i === question.levels.length - 1}
              onPress={() => move(i, i + 1)}
            >
              <Icon svg={<Icons.ArrowDown />} />
            </IconButton>
            <IconButton
              size="S"
              aria-label={`Remove level ${i}`}
              isDisabled={isDisabled || question.levels.length <= 2}
              onPress={() =>
                onChange({
                  levels: question.levels.filter((l) => l.id !== level.id),
                })
              }
            >
              <Icon svg={<Icons.Close />} />
            </IconButton>
          </li>
        ))}
      </ol>
      <div>
        <Button
          size="S"
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
    <Flex direction="column" gap="size-75">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
      >
        <Text size="S" weight="heavy">
          Criteria (optional)
        </Text>
        <Text size="XS" color="text-700">
          Describe what makes the answer true or false. OpenAI calls this
          question type a predicate.
        </Text>
      </Flex>
      <div css={rowCSS}>
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
        <span />
      </div>
    </Flex>
  );
}
