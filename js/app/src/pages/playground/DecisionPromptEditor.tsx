import { css } from "@emotion/react";
import { useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import {
  Alert,
  Button,
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Tag,
  TagGroup,
  TagList,
  Text,
  TextField,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  selectPlaygroundInstance,
  selectPlaygroundInstanceDecisionPrompt,
} from "@phoenix/store/playground/selectors";
import type {
  DecisionQuestionDraft,
  DecisionPromptDraft,
  DecisionStateDraft,
} from "@phoenix/store/playground/types";

import { DecisionQuestionEditor } from "./DecisionQuestionEditor";
import {
  createDecisionDraft,
  createDecisionQuestion,
  decisionFieldId,
  inputsStateValue,
  maskUntouchedErrors,
  MAX_DECISION_QUESTIONS,
  parseStateInputNames,
  switchDecisionStateMode,
  validateDecisionDraft,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";

function isStateMode(value: unknown): value is DecisionStateDraft["mode"] {
  return value === "template" || value === "inputs";
}

const questionListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const FOOTER_MIN_HEIGHT = 32;

const statePreviewCSS = css`
  margin: 0;
  font-size: var(--global-font-size-s);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
`;

const inputNameTagCSS = css`
  gap: var(--global-dimension-size-50);
  padding-top: 0;
  padding-bottom: 0;
  height: var(--global-dimension-size-300);
  font-family: var(--global-font-family-mono);
`;

const removeInputNameButtonCSS = css`
  display: flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  color: var(--global-text-color-700);
  cursor: pointer;
  font-size: var(--global-font-size-s);
  border-radius: var(--global-rounding-small);
  outline: none;
  &[data-hovered] {
    color: var(--global-text-color-900);
  }
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
  }
  &[data-disabled] {
    cursor: default;
    opacity: 0.5;
  }
`;

/**
 * Template or Inputs, the way an AI message picks between text and tool
 * calls: each mode keeps its own content.
 */
function DecisionStateModeRadioGroup({
  mode,
  isDisabled,
  onChange,
}: {
  mode: DecisionStateDraft["mode"];
  isDisabled: boolean;
  onChange: (mode: DecisionStateDraft["mode"]) => void;
}) {
  return (
    <SegmentedControl
      size="S"
      aria-label="State mode"
      selectedKey={mode}
      isDisabled={isDisabled}
      onSelectionChange={(key) => {
        if (isStateMode(key)) onChange(key);
      }}
    >
      <TooltipTrigger delay={0}>
        <SegmentedControlItem id="template">Template</SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Write the state as a template over the inputs
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={0}>
        <SegmentedControlItem id="inputs">Inputs</SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Send the inputs themselves as the state
        </Tooltip>
      </TooltipTrigger>
    </SegmentedControl>
  );
}

/**
 * The inputs an `inputs` state is made of: one tag per input, and a field
 * that adds the names typed into it on Enter, a comma, or leaving it.
 */
function DecisionStateInputNames({
  names,
  isDisabled,
  isInvalid,
  onChange,
  onBlur,
}: {
  names: readonly string[];
  isDisabled: boolean;
  isInvalid: boolean;
  onChange: (names: string[]) => void;
  onBlur: () => void;
}) {
  const [pending, setPending] = useState("");
  const addPending = (text: string) => {
    const added = parseStateInputNames(text).filter(
      (name) => !names.includes(name)
    );
    setPending("");
    if (added.length > 0) onChange([...names, ...new Set(added)]);
  };
  return (
    <Flex direction="column" gap="size-100">
      {names.length > 0 ? (
        <TagGroup
          aria-label="State inputs"
          onRemove={(keys) => onChange(names.filter((name) => !keys.has(name)))}
        >
          <TagList>
            {names.map((name) => (
              <Tag
                key={name}
                id={name}
                textValue={name}
                isDisabled={isDisabled}
                css={inputNameTagCSS}
              >
                {name}
                <AriaButton
                  slot="remove"
                  aria-label={`Remove ${name}`}
                  isDisabled={isDisabled}
                  css={removeInputNameButtonCSS}
                >
                  <Icon svg={<Icons.Close />} />
                </AriaButton>
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      ) : null}
      <TextField
        size="S"
        value={pending}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        onChange={(text) => {
          if (text.includes(",")) {
            addPending(text);
          } else {
            setPending(text);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addPending(pending);
          }
        }}
        onBlur={() => {
          addPending(pending);
          onBlur();
        }}
      >
        <Label>Add input</Label>
        <Input placeholder={names.length ? "another input" : "ticket"} />
        <Text slot="description">
          One input sends its value as the state; several send an object keyed
          by name.
        </Text>
      </TextField>
    </Flex>
  );
}

/** What an `inputs` state sends: the values typed in so far, or its shape. */
function DecisionStatePreview({ names }: { names: readonly string[] }) {
  const variables = usePlaygroundContext(
    (state) => state.input.variablesValueCache
  );
  const isDatasetMode = usePlaygroundContext(
    (state) => state.datasetId != null
  );
  if (names.length === 0) return null;

  const hasValues =
    !isDatasetMode && names.every((name) => variables?.[name] != null);
  const preview = hasValues
    ? JSON.stringify(inputsStateValue(names, variables))
    : names.length === 1
      ? `<${names[0]}>`
      : `{ ${names.map((name) => `${JSON.stringify(name)}: <${name}>`).join(", ")} }`;

  return (
    <Flex direction="column" gap="size-50">
      <Text size="S" color="text-700">
        {hasValues ? "State preview" : "State shape"}
      </Text>
      <pre css={statePreviewCSS} aria-label="Decision state preview">
        <code>{preview}</code>
      </pre>
    </Flex>
  );
}

/**
 * One instance's decision prompt, laid out like a chat template: the state
 * is one card and each question is another, so a decision column reads the
 * same way as a prompt column beside it.
 */
export function DecisionPromptEditor({
  playgroundInstanceId: instanceId,
  availablePaths,
}: PlaygroundInstanceProps & {
  /** Dataset paths the state template can autocomplete, as a prompt message does. */
  availablePaths?: string[];
}) {
  const isRunning = usePlaygroundContext(
    (state) => selectPlaygroundInstance(instanceId)(state)?.activeRunId != null
  );
  const decisionPromptId = usePlaygroundContext(
    (state) => selectPlaygroundInstance(instanceId)(state)?.decisionPromptId
  );
  const decisionPrompt = usePlaygroundContext(
    selectPlaygroundInstanceDecisionPrompt(instanceId)
  );
  const updateDecisionPrompt = usePlaygroundContext(
    (state) => state.updateDecisionPrompt
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  // The state is the evidence the user supplies, so it takes the user
  // message tint, as a chat template's user message would.
  const stateStyles = useChatMessageStyles("user");
  // Deleting a question removes the focused element; focus moves here so
  // keyboard users are not dropped to the document body.
  const addQuestionButtonRef = useRef<HTMLButtonElement>(null);
  const request = decisionPrompt ?? createDecisionDraft();
  // Fields the user has left. Empty required fields are reported only once
  // the user has been there, so a new question or option does not open in
  // an error state; see maskUntouchedErrors.
  const [touchedFields, setTouchedFields] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const touch = (fieldId: string) =>
    setTouchedFields((previous) =>
      previous.has(fieldId) ? previous : new Set(previous).add(fieldId)
    );
  const errors = maskUntouchedErrors({
    errors: validateDecisionDraft(request),
    touched: touchedFields,
  });
  const canAddQuestion = request.questions.length < MAX_DECISION_QUESTIONS;

  const update = (patch: Partial<DecisionPromptDraft>) =>
    updateDecisionPrompt({ instanceId, request: { ...request, ...patch } });
  const { state } = request;
  const updateState = (next: DecisionStateDraft) => update({ state: next });
  const stateSummary =
    state.mode === "inputs" ? state.inputNames.join(", ") : state.template;
  const updateQuestion = (
    questionId: string,
    patch: Partial<DecisionQuestionDraft>
  ) =>
    update({
      questions: request.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      ),
    });

  const addQuestion = () => {
    let suffix = request.questions.length + 1;
    while (
      request.questions.some(
        (question) => question.name === `question_${suffix}`
      )
    ) {
      suffix += 1;
    }
    update({
      questions: [
        ...request.questions,
        createDecisionQuestion({
          type: "predicate",
          name: `question_${suffix}`,
        }),
      ],
    });
  };

  return (
    <Flex direction="column" gap="size-100">
      <Card
        collapsible
        collapseButtonLabel="State"
        title="State"
        testId="decision-state"
        {...stateStyles}
        headerContent={
          <CardCollapsedPreview>{stateSummary}</CardCollapsedPreview>
        }
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <DecisionStateModeRadioGroup
              mode={state.mode}
              isDisabled={isRunning}
              onChange={(mode) =>
                updateState(
                  switchDecisionStateMode({ state, mode, templateFormat })
                )
              }
            />
            <CopyToClipboardButton
              text={stateSummary}
              aria-label="Copy state"
            />
          </Flex>
        }
      >
        {errors.state ? (
          <Alert variant="danger" banner>
            {errors.state}
          </Alert>
        ) : null}
        {state.mode === "inputs" ? (
          <View padding="size-100">
            <Flex direction="column" gap="size-100">
              <DecisionStateInputNames
                names={state.inputNames}
                isDisabled={isRunning}
                isInvalid={!!errors.state}
                onChange={(inputNames) => updateState({ ...state, inputNames })}
                onBlur={() => touch(decisionFieldId.state())}
              />
              <DecisionStatePreview names={state.inputNames} />
            </Flex>
          </View>
        ) : (
          <TemplateEditorWrap readOnly={isRunning}>
            <TemplateEditor
              // Loading replaces the draft and its id, and switching modes
              // seeds the template; typing must keep the editor mounted.
              key={`template-${instanceId}-${decisionPromptId}-${templateFormat}`}
              aria-label="Decision state"
              templateFormat={templateFormat}
              defaultValue={state.template}
              placeholder="The evidence the questions are asked about"
              onChange={(template) => updateState({ ...state, template })}
              onBlur={() => touch(decisionFieldId.state())}
              readOnly={isRunning}
              availablePaths={availablePaths}
            />
          </TemplateEditorWrap>
        )}
      </Card>

      {errors.questions ? (
        <Alert variant="danger">{errors.questions}</Alert>
      ) : null}
      <ul css={questionListCSS} aria-label="Questions">
        {request.questions.map((question, index) => (
          <li key={question.id}>
            <DecisionQuestionEditor
              question={question}
              index={index}
              errors={errors.byQuestionId[question.id]}
              isDisabled={isRunning}
              canRemove={request.questions.length > 1}
              onTouch={touch}
              onChange={(patch) => updateQuestion(question.id, patch)}
              onRemove={() => {
                update({
                  questions: request.questions.filter(
                    (candidate) => candidate.id !== question.id
                  ),
                });
                addQuestionButtonRef.current?.focus();
              }}
            />
          </li>
        ))}
      </ul>
      <Flex
        direction="row"
        justifyContent="end"
        gap="size-100"
        minHeight={FOOTER_MIN_HEIGHT}
      >
        <Button
          ref={addQuestionButtonRef}
          size="S"
          aria-label="add question"
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          isDisabled={isRunning || !canAddQuestion}
          onPress={addQuestion}
        >
          Question
        </Button>
      </Flex>
    </Flex>
  );
}
