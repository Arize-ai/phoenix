import { css } from "@emotion/react";
import { useMemo } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Label,
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
      <Flex direction="column" gap="size-200">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
          wrap
        >
          <Flex direction="column" gap="size-50">
            <Text weight="heavy">Decision request</Text>
            <Text size="S" color="text-700">
              Evidence plus typed questions. Every decision model above answers
              the same request, so differences in output are differences in the
              model.
            </Text>
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center">
            <DecisionImportDialog isDisabled={isRunning} />
            <DecisionExportDialog />
          </Flex>
        </Flex>

        <Flex direction="column" gap="size-75">
          <Flex direction="row" justifyContent="space-between" alignItems="end">
            <Label>State</Label>
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
                // Uncontrolled: remount when the format toggles or a request is imported (revision)
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
            <Text size="XS" color="danger">
              {errors.state}
            </Text>
          ) : (
            <Text size="XS" color="text-700">
              {templateFormat === TemplateFormats.NONE
                ? "The evidence the questions are asked about."
                : templateFormat === TemplateFormats.Mustache
                  ? "The evidence the questions are asked about. Use {{variable}} to fill values from the Inputs panel."
                  : "The evidence the questions are asked about. Use {variable} to fill values from the Inputs panel."}
            </Text>
          )}
        </Flex>

        <Flex direction="column" gap="size-50">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Label>Questions</Label>
            <Text size="XS" color="text-700">
              {request.questions.length} of 255
            </Text>
          </Flex>
          {errors.questions ? (
            <Text size="XS" color="danger">
              {errors.questions}
            </Text>
          ) : null}
          <ul
            css={css`
              list-style: none;
              margin: 0;
              padding: 0;
            `}
          >
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
          <View paddingTop="size-100">
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.Plus />} />}
              isDisabled={isRunning || request.questions.length >= 255}
              onPress={() => {
                let suffix = request.questions.length + 1;
                while (
                  request.questions.some((q) => q.name === `question_${suffix}`)
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
          </View>
        </Flex>
      </Flex>
    </View>
  );
}
