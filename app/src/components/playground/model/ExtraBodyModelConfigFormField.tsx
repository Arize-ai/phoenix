import { css } from "@emotion/react";
import type { JSONSchema7 } from "json-schema";
import { useState } from "react";

import { Label, Text } from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { readInvocationConfigField } from "@phoenix/pages/playground/providerAdapters";
import type { PlaygroundNormalizedInstance } from "@phoenix/store";
import { isObject } from "@phoenix/typeUtils";

const EMPTY_JSON_STATES = ["", "{}", "{\n  \n}"] as const;

const extraBodyJSONSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: true,
};

const fieldContainerCSS = css`
  & .view {
    width: 100%;
  }
`;

function formatExtraBodyForEditor(value: unknown): string {
  if (
    !isObject(value) ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  ) {
    return "{\n  \n}";
  }
  return JSON.stringify(value, null, 2);
}

function parseExtraBodyEditorValue(
  value: string
):
  | { success: true; data: Record<string, unknown> | undefined }
  | { success: false; message: string } {
  const trimmed = value.trim();
  if ((EMPTY_JSON_STATES as readonly string[]).includes(trimmed)) {
    return { success: true, data: undefined };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!isObject(parsed) || Array.isArray(parsed)) {
      return { success: false, message: "Extra Body must be a JSON object" };
    }
    return {
      success: true,
      data:
        Object.keys(parsed).length > 0
          ? (parsed as Record<string, unknown>)
          : undefined,
    };
  } catch {
    return { success: false, message: "Invalid JSON format" };
  }
}

export function ExtraBodyModelConfigFormField({
  instance,
}: {
  instance: PlaygroundNormalizedInstance;
}) {
  const setInvocationParameterField = usePlaygroundContext(
    (state) => state.setInvocationParameterField
  );
  const extraBody = readInvocationConfigField(
    instance.model.provider,
    instance.model.invocationParameters,
    "extraBody"
  );
  const [editorValue, setEditorValue] = useState(() =>
    formatExtraBodyForEditor(extraBody)
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  function handleChange(value: string) {
    setEditorValue(value);
    const result = parseExtraBodyEditorValue(value);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    setErrorMessage(undefined);
    setInvocationParameterField({
      instanceId: instance.id,
      fieldName: "extraBody",
      value: result.data,
    });
  }

  return (
    <div css={fieldContainerCSS}>
      <div css={fieldBaseCSS}>
        <Label>Extra Body</Label>
        <CodeWrap>
          <JSONEditor
            value={editorValue}
            onChange={handleChange}
            jsonSchema={extraBodyJSONSchema}
            optionalLint
            placeholder={`{"provider_specific_option": true}`}
          />
        </CodeWrap>
        {errorMessage ? (
          <Text slot="errorMessage" color="danger">
            {errorMessage}
          </Text>
        ) : null}
        {!errorMessage ? (
          <Text slot="description">Additional provider-specific options.</Text>
        ) : null}
      </div>
    </div>
  );
}
