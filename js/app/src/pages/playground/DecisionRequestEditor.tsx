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
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import type {
  DecisionQuestionDraft,
  DecisionRequestDraft,
} from "@phoenix/store/playground/types";

const STATE_EDITOR_MODES: ReadonlyArray<
  DecisionRequestDraft["stateEditorMode"]
> = ["text", "json", "input", "inputs"];

import { DecisionQuestionEditor } from "./DecisionQuestionEditor";
import {
  createDecisionDraft,
  createDecisionQuestion,
  decisionFieldId,
  maskUntouchedErrors,
  MAX_DECISION_QUESTIONS,
  parseStateInputNames,
  validateDecisionDraft,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";

const jsonEditorCSS = css`
  .cm-editor {
    min-height: 75px;
  }
`;

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

function DecisionStatePreview({ request }: { request: DecisionRequestDraft }) {
  const variables = usePlaygroundContext(
    (state) => state.input.variablesValueCache
  );
  const isDatasetMode = usePlaygroundContext(
    (state) => state.datasetId != null
  );
  const names = parseStateInputNames(request.state);
  const isValueMode = request.stateEditorMode === "input";
  const hasValidNames =
    names.length > 0 && (!isValueMode || names.length === 1);
  if (!hasValidNames) return null;

  const hasValues =
    !isDatasetMode && names.every((name) => variables?.[name] != null);
  const getValue = (name: string) => variables?.[name] ?? "";
  const preview = hasValues
    ? JSON.stringify(
        isValueMode
          ? getValue(names[0])
          : Object.fromEntries(names.map((name) => [name, getValue(name)]))
      )
    : isValueMode
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
 * One instance's decision request, laid out like a chat template: the state
 * is one card and each question is another, so a decision column reads the
 * same way as a prompt column beside it.
 */
export function DecisionRequestEditor({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const updateDecisionRequest = usePlaygroundContext(
    (state) => state.updateDecisionRequest
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const editorRevision = usePlaygroundContext(
    (state) => state.externallyUpdatedDecisionRevisionById[instanceId] ?? 0
  );
  // The state is the evidence the user supplies, so it takes the user
  // message tint, as a chat template's user message would.
  const stateStyles = useChatMessageStyles("user");
  const isRunning = instance?.activeRunId != null;
  // Deleting a question removes the focused element; focus moves here so
  // keyboard users are not dropped to the document body.
  const addQuestionButtonRef = useRef<HTMLButtonElement>(null);
  const request = instance?.decisionRequest ?? createDecisionDraft();
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

  const update = (patch: Partial<DecisionRequestDraft>) =>
    updateDecisionRequest({ instanceId, request: { ...request, ...patch } });
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
          <CardCollapsedPreview>{request.state}</CardCollapsedPreview>
        }
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <SegmentedControl
              size="S"
              aria-label="State editor mode"
              selectedKey={request.stateEditorMode}
              isDisabled={isRunning}
              onSelectionChange={(key) =>
                update({
                  stateEditorMode:
                    STATE_EDITOR_MODES.find((format) => format === key) ??
                    "text",
                })
              }
            >
              <SegmentedControlItem id="text" aria-label="Text">
                Text
              </SegmentedControlItem>
              <SegmentedControlItem id="json" aria-label="JSON">
                JSON
              </SegmentedControlItem>
              <SegmentedControlItem id="input" aria-label="Value">
                Value
              </SegmentedControlItem>
              <SegmentedControlItem id="inputs" aria-label="Object">
                Object
              </SegmentedControlItem>
            </SegmentedControl>
            <CopyToClipboardButton
              text={request.state}
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
        {request.stateEditorMode === "input" ? (
          <View padding="size-100">
            <Flex direction="column" gap="size-100">
              <TextField
                size="S"
                value={request.state}
                onChange={(state) => update({ state })}
                onBlur={() => touch(decisionFieldId.state())}
                isDisabled={isRunning}
                isInvalid={!!errors.state}
              >
                <Label>Input name</Label>
                <Input placeholder="ticket" />
                <Text slot="description">Use this input's value directly.</Text>
              </TextField>
              <DecisionStatePreview request={request} />
            </Flex>
          </View>
        ) : request.stateEditorMode === "inputs" ? (
          <View padding="size-100">
            <Flex direction="column" gap="size-100">
              <TextField
                size="S"
                value={request.state}
                onChange={(state) => update({ state })}
                onBlur={() => touch(decisionFieldId.state())}
                isDisabled={isRunning}
                isInvalid={!!errors.state}
              >
                <Label>Input names</Label>
                <Input placeholder="reference, output" />
                <Text slot="description">
                  Build an object keyed by these comma-separated names.
                </Text>
              </TextField>
              <DecisionStatePreview request={request} />
            </Flex>
          </View>
        ) : request.stateEditorMode === "json" ? (
          <div css={jsonEditorCSS}>
            <JSONEditor
              aria-label="Decision state"
              value={request.state}
              onChange={(state) => update({ state })}
              onBlur={() => touch(decisionFieldId.state())}
              readOnly={isRunning}
            />
          </div>
        ) : (
          <TemplateEditorWrap readOnly={isRunning}>
            <TemplateEditor
              // Loading replaces the draft; typing must keep the editor mounted.
              key={`text-${instanceId}-${editorRevision}-${templateFormat}`}
              aria-label="Decision state"
              templateFormat={templateFormat}
              defaultValue={request.state}
              placeholder="The evidence the questions are asked about"
              onChange={(state) => update({ state })}
              onBlur={() => touch(decisionFieldId.state())}
              readOnly={isRunning}
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
              templateFormat={templateFormat}
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
