import { useCallback, useState } from "react";
import { css } from "@emotion/react";

import { Field } from "@arizeai/components";

import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { safelyParseJSON, safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

/**
 * Editor for message tool calls
 */
export function InvocationParameterJsonEditor({
  defaultValue,
  onChange: handleChange,
  label,
  errorMessage,
}: {
  defaultValue: unknown;
  // jsonValue is typed as any on the gql side to allow any json value to be set
  // we can mostly assume this any is safe because we are safely parsing and stringifying incoming and outgoing json
  onChange: (value: unknown) => void;
  label: string;
  errorMessage?: string;
}) {
  const [editorValue, setEditorValue] = useState(
    defaultValue == null ? "" : (safelyStringifyJSON(defaultValue).json ?? "")
  );

  const onChange = useCallback(
    (value: string) => {
      setEditorValue(value);
      const { json: parsedValue } = safelyParseJSON(value);
      if (parsedValue == null && value !== "") {
        return;
      }
      handleChange(parsedValue);
    },
    [handleChange]
  );

  return (
    <div
      css={css`
        & .ac-view {
          width: 100%;
        }
      `}
    >
      <Field
        label={label}
        errorMessage={errorMessage}
        validationState={errorMessage ? "invalid" : undefined}
      >
        <CodeWrap>
          <JSONEditor value={editorValue} onChange={onChange} optionalLint />
        </CodeWrap>
      </Field>
    </div>
  );
}
