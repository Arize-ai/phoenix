import { css } from "@emotion/react";

import { Alert, Flex, Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { DecisionPromptDraft } from "@phoenix/store/playground/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

import {
  extractDecisionVariables,
  previewDecision,
  toDecisionVariableValues,
} from "./decisionUtils";

const textPreviewCSS = css`
  margin: 0;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--ac-global-font-family-code);
  font-size: var(--global-font-size-s);
`;

/**
 * The variables a preview fills the decision with: over a dataset, the first
 * example's, with their JSON types; otherwise the Variables pane's, read as a
 * decision reads them. A string says why there are none.
 */
function usePreviewVariables({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}):
  | { source: string; variables: Record<string, unknown> }
  | { message: string } {
  const datasetId = usePlaygroundContext((state) => state.datasetId);
  const exampleVariables = usePlaygroundContext((state) =>
    state.datasetId != null
      ? state.stateByDatasetId[state.datasetId]?.exampleVariables
      : undefined
  );
  const input = usePlaygroundContext((state) => state.input);
  if (datasetId == null) {
    return {
      source: "the values in Variables",
      variables: toDecisionVariableValues({
        names: extractDecisionVariables({ draft, templateFormat }),
        input,
      }),
    };
  }
  if (exampleVariables == null) return { message: "Loading example 1…" };
  if (exampleVariables.length === 0) {
    return { message: "The dataset has no examples to preview with." };
  }
  const [first] = exampleVariables;
  if (!isStringKeyedObject(first) || Array.isArray(first)) {
    return {
      message:
        "Example 1 has no object at the template variables path to read variables from.",
    };
  }
  return { source: "example 1", variables: first };
}

/**
 * The state a decision sends for the current variables (or the dataset's
 * first example), rendered by the server's rules, or why it can't be.
 */
export function DecisionStatePreview({
  draft,
  templateFormat,
}: {
  draft: DecisionPromptDraft;
  templateFormat: TemplateFormat;
}) {
  const previewVariables = usePreviewVariables({ draft, templateFormat });
  if ("message" in previewVariables) {
    return (
      <View padding="size-200">
        <Text color="text-700">{previewVariables.message}</Text>
      </View>
    );
  }
  const preview = previewDecision({
    draft,
    templateFormat,
    variables: previewVariables.variables,
  });
  return (
    <section aria-label="State preview">
      <View paddingX="size-200" paddingTop="size-100">
        <Flex direction="row" gap="size-50">
          <Text size="XS" color="text-700">
            {preview.ok
              ? `Sent for ${previewVariables.source}${
                  typeof preview.rendered.state === "string"
                    ? ", as text"
                    : ", as JSON"
                }`
              : `Can't be sent for ${previewVariables.source}`}
          </Text>
        </Flex>
      </View>
      {!preview.ok ? (
        <View padding="size-200">
          <Alert variant="danger">{preview.error}</Alert>
        </View>
      ) : typeof preview.rendered.state === "string" ? (
        <pre css={textPreviewCSS}>{preview.rendered.state}</pre>
      ) : (
        <JSONBlock value={JSON.stringify(preview.rendered.state, null, 2)} />
      )}
    </section>
  );
}
