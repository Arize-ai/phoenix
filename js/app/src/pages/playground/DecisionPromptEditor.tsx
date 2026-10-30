import { css } from "@emotion/react";
import { useRef, useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
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
import { DecisionStateEditor } from "./DecisionStateEditor";
import {
  createDecisionDraft,
  createDecisionQuestion,
  decisionFieldId,
  maskUntouchedErrors,
  MAX_DECISION_QUESTIONS,
  switchDecisionStateMode,
  validateDecisionDraft,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";

function isStateMode(value: unknown): value is DecisionStateDraft["mode"] {
  return value === "text" || value === "json";
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

/**
 * Text or JSON, the way an AI message picks between text and tool calls:
 * each mode keeps its own content.
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
        <SegmentedControlItem id="text">Text</SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Send the state as text, a template over the variables
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={0}>
        <SegmentedControlItem id="json">JSON</SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Send the state as JSON; a string that is one variable sends its value
        </Tooltip>
      </TooltipTrigger>
    </SegmentedControl>
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
    errors: validateDecisionDraft({ draft: request, templateFormat }),
    touched: touchedFields,
  });
  const canAddQuestion = request.questions.length < MAX_DECISION_QUESTIONS;

  const update = (patch: Partial<DecisionPromptDraft>) =>
    updateDecisionPrompt({ instanceId, request: { ...request, ...patch } });
  const { state } = request;
  const updateState = (next: DecisionStateDraft) => update({ state: next });
  // The state's error waits until focus leaves the editor, so typing
  // doesn't flash a banner; the editor marks invalid JSON as it is typed.
  const [isStateFocused, setIsStateFocused] = useState(false);
  // What Copy copies and the collapsed card shows: the template as written.
  const stateSummary = state.mode === "json" ? state.json : state.text;
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
        {errors.state && !isStateFocused ? (
          <Alert variant="danger" banner>
            {errors.state}
          </Alert>
        ) : null}
        <DecisionStateEditor
          // Loading replaces the draft and its id; typing must keep the
          // editor mounted.
          editorKey={`${instanceId}-${decisionPromptId}`}
          state={state}
          templateFormat={templateFormat}
          isDisabled={isRunning}
          availablePaths={availablePaths}
          onChange={updateState}
          onFocusChange={(isFocused) => {
            setIsStateFocused(isFocused);
            if (!isFocused) touch(decisionFieldId.state());
          }}
        />
      </Card>

      {errors.questions ? (
        <Alert variant="danger">{errors.questions}</Alert>
      ) : null}
      <ul css={questionListCSS} aria-label="Questions">
        {request.questions.map((question, index) => (
          <li key={question.id}>
            <DecisionQuestionEditor
              question={question}
              templateFormat={templateFormat}
              availablePaths={availablePaths}
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
