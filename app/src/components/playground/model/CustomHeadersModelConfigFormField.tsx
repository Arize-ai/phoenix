import { useCallback, useEffect, useState } from "react";
import { JSONSchema7 } from "json-schema";
import { css } from "@emotion/react";

import { Label, Text } from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  httpHeadersJSONSchema,
  stringToHttpHeadersSchema,
} from "@phoenix/schemas/httpHeadersSchema";
import { PlaygroundNormalizedInstance } from "@phoenix/store";
/**
 * Format headers object for JSON editor with proper indentation and empty state handling
 */
const formatHeadersForEditor = (
  headers: Record<string, string> | null | undefined
): string => {
  if (!headers) {
    return "{\n  \n}";
  }

  const hasContent = Object.keys(headers).length > 0;
  return hasContent ? JSON.stringify(headers, null, 2) : "{\n  \n}";
};

const fieldContainerCSS = css`
  & .ac-view {
    width: 100%;
  }
`;

export function CustomHeadersModelConfigFormField({
  instance,
  onErrorChange,
}: {
  instance: PlaygroundNormalizedInstance;
  onErrorChange?: (hasError: boolean) => void;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const { customHeaders } = instance.model;

  const [editorValue, setEditorValue] = useState(() =>
    formatHeadersForEditor(customHeaders)
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Cleanup: reset error state when component unmounts
  useEffect(() => {
    return () => onErrorChange?.(false);
  }, [onErrorChange]);

  const handleChange = useCallback(
    (value: string) => {
      setEditorValue(value);

      const result = stringToHttpHeadersSchema.safeParse(value);
      if (result.success) {
        setErrorMessage(undefined);
        onErrorChange?.(false);
        updateModel({
          instanceId: instance.id,
          patch: { customHeaders: result.data },
        });
      } else {
        const firstError = result.error.errors[0];
        setErrorMessage(
          firstError?.message ??
            firstError?.path?.join(".") ??
            "Invalid headers format"
        );
        onErrorChange?.(true);
      }
    },
    [instance.id, updateModel, onErrorChange]
  );

  return (
    <div css={fieldContainerCSS}>
      <div css={fieldBaseCSS}>
        <Label>Custom Headers</Label>
        <CodeWrap>
          <JSONEditor
            value={editorValue}
            onChange={handleChange}
            jsonSchema={httpHeadersJSONSchema as JSONSchema7}
            optionalLint
            placeholder={`{"X-Custom-Header": "custom-value"}`}
          />
        </CodeWrap>
        {errorMessage ? (
          <Text slot="errorMessage" color="danger">
            {errorMessage}
          </Text>
        ) : null}
        {!errorMessage ? (
          <Text slot="description">
            Custom HTTP headers to send with requests to the LLM provider
          </Text>
        ) : null}
      </div>
    </div>
  );
}
