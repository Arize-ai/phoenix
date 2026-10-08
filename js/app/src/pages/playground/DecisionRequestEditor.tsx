import { css } from "@emotion/react";
import { useMemo } from "react";

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
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type {
  DecisionQuestionDraft,
  DecisionRequestDraft,
} from "@phoenix/store/playground/types";

import { DecisionExportDialog } from "./DecisionExportDialog";
import { DecisionImportDialog } from "./DecisionImportDialog";
import { DecisionQuestionEditor } from "./DecisionQuestionEditor";
import {
  createDecisionDraft,
  createDecisionQuestion,
  validateDecisionDraft,
} from "./decisionUtils";

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

function useDecisionDraft() {
  const draft = usePlaygroundContext((state) => state.decisionRequest);
  const setDecisionRequest = usePlaygroundContext(
    (state) => state.setDecisionRequest
  );
  const request = draft ?? createDecisionDraft();
  const update = (patch: Partial<DecisionRequestDraft>) =>
    setDecisionRequest({ ...request, ...patch });
  return { request, update };
}

/**
 * Import and Export for the shared request. Rendered in the instance row so
 * the models and the request's I/O share one toolbar.
 */
export function DecisionRequestActions() {
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <DecisionImportDialog isDisabled={isRunning} />
      <DecisionExportDialog />
    </Flex>
  );
}

/**
 * The decision request shared by every decision instance, laid out like a
 * chat template: the state is one card and each question is another, so the
 * page reads the same way whichever model type is loaded.
 */
export function DecisionRequestEditor() {
  const { request, update } = useDecisionDraft();
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const errors = useMemo(() => validateDecisionDraft(request), [request]);
  const revision = request.revision ?? 0;

  const updateQuestion = (id: string, patch: Partial<DecisionQuestionDraft>) =>
    update({
      questions: request.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
    });

  const addQuestion = () => {
    let suffix = request.questions.length + 1;
    while (request.questions.some((q) => q.name === `question_${suffix}`)) {
      suffix += 1;
    }
    update({
      questions: [
        ...request.questions,
        createDecisionQuestion("noul", { name: `question_${suffix}` }),
      ],
    });
  };

  return (
    <View paddingX="size-200" paddingBottom="size-100">
      <Flex direction="column" gap="size-100">
        <Card
          collapsible
          collapseButtonLabel="State"
          title="State"
          testId="decision-state"
          backgroundColor="gray-100"
          borderColor="gray-300"
          headerContent={
            <CardCollapsedPreview>{request.state}</CardCollapsedPreview>
          }
          extra={
            <Flex direction="row" gap="size-100" alignItems="center">
              <SegmentedControl
                size="S"
                aria-label="State format"
                selectedKey={request.stateFormat}
                isDisabled={isRunning}
                onSelectionChange={(key) =>
                  update({ stateFormat: key === "json" ? "json" : "text" })
                }
              >
                <SegmentedControlItem id="text" aria-label="Text">
                  Text
                </SegmentedControlItem>
                <SegmentedControlItem id="json" aria-label="JSON">
                  JSON
                </SegmentedControlItem>
              </SegmentedControl>
              <CopyToClipboardButton text={request.state} />
            </Flex>
          }
        >
          {errors.state ? (
            <Alert variant="danger" banner>
              {errors.state}
            </Alert>
          ) : null}
          {request.stateFormat === "json" ? (
            <div css={jsonEditorCSS}>
              <JSONEditor
                key={`json-${revision}`}
                aria-label="Decision state"
                value={request.state}
                onChange={(state) => update({ state })}
                readOnly={isRunning}
              />
            </div>
          ) : (
            <TemplateEditorWrap readOnly={isRunning}>
              <TemplateEditor
                // Uncontrolled: remount when the format toggles or a request
                // is imported (revision).
                key={`text-${templateFormat}-${revision}`}
                aria-label="Decision state"
                templateFormat={templateFormat}
                defaultValue={request.state}
                placeholder="The evidence the questions are asked about"
                onChange={(state) => update({ state })}
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
                revision={revision}
                onChange={(patch) => updateQuestion(question.id, patch)}
                onRemove={() =>
                  update({
                    questions: request.questions.filter(
                      (q) => q.id !== question.id
                    ),
                  })
                }
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
            size="S"
            aria-label="add question"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            isDisabled={isRunning || request.questions.length >= 255}
            onPress={addQuestion}
          >
            Question
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}
