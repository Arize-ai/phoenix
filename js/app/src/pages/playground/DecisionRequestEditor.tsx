import { css } from "@emotion/react";
import { useMemo } from "react";

import {
  Alert,
  Button,
  Card,
  Counter,
  Flex,
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { TemplateEditor } from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
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

const editorFrameCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  overflow: hidden;
  .cm-editor {
    min-height: 96px;
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

function stateHelp(templateFormat: string): string {
  switch (templateFormat) {
    case TemplateFormats.Mustache:
      return "The evidence the questions are asked about. Use {{variable}} to fill values from the Inputs panel.";
    case TemplateFormats.FString:
      return "The evidence the questions are asked about. Use {variable} to fill values from the Inputs panel.";
    default:
      return "The evidence the questions are asked about.";
  }
}

/**
 * The decision request shared by every decision instance: the evidence
 * (state) and the typed questions. Model and endpoint live on each instance,
 * so comparing instances means the same questions over the same evidence.
 */
export function DecisionRequestEditor() {
  const draft = usePlaygroundContext((state) => state.decisionRequest);
  const setDecisionRequest = usePlaygroundContext(
    (state) => state.setDecisionRequest
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const request = draft ?? createDecisionDraft();
  const errors = useMemo(() => validateDecisionDraft(request), [request]);

  const update = (patch: Partial<DecisionRequestDraft>) =>
    setDecisionRequest({ ...request, ...patch });
  const updateQuestion = (id: string, patch: Partial<DecisionQuestionDraft>) =>
    update({
      questions: request.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
    });

  return (
    <View paddingX="size-200" paddingBottom="size-200">
      <Card
        title="Decision request"
        subTitle="Shared by every decision instance"
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <DecisionImportDialog isDisabled={isRunning} />
            <DecisionExportDialog />
          </Flex>
        }
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-300">
            <Flex direction="column" gap="size-75">
              <Flex
                direction="row"
                justifyContent="space-between"
                alignItems="end"
              >
                <Text size="S" weight="heavy">
                  State
                </Text>
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
              </Flex>
              <div css={editorFrameCSS}>
                {request.stateFormat === "json" ? (
                  <JSONEditor
                    key={`json-${request.revision ?? 0}`}
                    aria-label="Decision state"
                    value={request.state}
                    onChange={(state) => update({ state })}
                    readOnly={isRunning}
                  />
                ) : (
                  <TemplateEditor
                    // Uncontrolled: remount when the format toggles or a
                    // request is imported (revision).
                    key={`text-${request.stateFormat}-${request.revision ?? 0}`}
                    aria-label="Decision state"
                    templateFormat={templateFormat}
                    defaultValue={request.state}
                    onChange={(state) => update({ state })}
                    readOnly={isRunning}
                  />
                )}
              </div>
              {errors.state ? (
                <Alert variant="danger">{errors.state}</Alert>
              ) : (
                <Text size="XS" color="text-700">
                  {stateHelp(templateFormat)}
                </Text>
              )}
            </Flex>

            <Flex direction="column" gap="size-100">
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text size="S" weight="heavy">
                  Questions
                </Text>
                <Counter>{request.questions.length}</Counter>
              </Flex>
              {errors.questions ? (
                <Alert variant="danger">{errors.questions}</Alert>
              ) : null}
              <ul css={questionListCSS}>
                {request.questions.map((question, index) => (
                  <li key={question.id}>
                    <DecisionQuestionEditor
                      question={question}
                      index={index}
                      errors={errors.byQuestionId[question.id]}
                      isDisabled={isRunning}
                      canRemove={request.questions.length > 1}
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
              <div>
                <Button
                  size="S"
                  variant="quiet"
                  leadingVisual={<Icon svg={<Icons.Plus />} />}
                  isDisabled={isRunning || request.questions.length >= 255}
                  onPress={() => {
                    let suffix = request.questions.length + 1;
                    while (
                      request.questions.some(
                        (q) => q.name === `question_${suffix}`
                      )
                    ) {
                      suffix += 1;
                    }
                    update({
                      questions: [
                        ...request.questions,
                        createDecisionQuestion("noul", {
                          name: `question_${suffix}`,
                        }),
                      ],
                    });
                  }}
                >
                  Add question
                </Button>
              </div>
            </Flex>
          </Flex>
        </View>
      </Card>
    </View>
  );
}
