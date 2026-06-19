import { css } from "@emotion/react";
import type { JSONSchema7 } from "json-schema";
import { useEffect, useRef, useState } from "react";

import { Label, Text } from "@phoenix/components";
import { CodeWrap, JSONEditor } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

const fieldContainerCSS = css`
  & .view {
    width: 100%;
  }
`;

export type JSONObjectFieldParseResult<FieldValue> =
  | { success: true; data: FieldValue | undefined }
  | { success: false; message: string };

export type JSONObjectFieldCodec<FieldValue> = {
  /**
   * Parses raw editor text into the canonical store value. Return `success:
   * false` with a user-facing message when the text isn't a valid value;
   * return `success: true` with `data: undefined` for the empty/cleared state.
   */
  parse: (raw: string) => JSONObjectFieldParseResult<FieldValue>;
  /**
   * Renders the canonical store value as the editor's initial text. Used only
   * on mount; subsequent edits are driven by user input.
   */
  format: (value: FieldValue | undefined) => string;
};

type JSONObjectModelConfigFormFieldProps<FieldValue> = {
  label: string;
  description: string;
  placeholder: string;
  jsonSchema: JSONSchema7;
  value: FieldValue | undefined;
  codec: JSONObjectFieldCodec<FieldValue>;
  /**
   * Called with the canonical value when the user types a valid payload.
   * Not called on invalid input — invalid input leaves the store untouched
   * and surfaces `onErrorChange(true)` instead, so the user sees what they
   * typed in the editor but the store keeps its last good value.
   */
  onChange: (value: FieldValue | undefined) => void;
  /**
   * Called when the parse-success boolean changes. Consumers should use this
   * to disable downstream save actions while invalid input is in the editor
   * — otherwise the user could save a stale "last good" value while seeing
   * the new (invalid) one. Fires `false` on unmount so a field that gets
   * hidden in an error state doesn't leave the parent permanently disabled.
   */
  onErrorChange?: (hasError: boolean) => void;
};

/**
 * Editor for a JSON-object–valued model config field. Owns the editor-text
 * and error-message UI state; delegates the value codec to the caller via
 * `codec` and store wiring via `value` + `onChange`.
 */
export function JSONObjectModelConfigFormField<FieldValue>({
  label,
  description,
  placeholder,
  jsonSchema,
  value,
  codec,
  onChange,
  onErrorChange,
}: JSONObjectModelConfigFormFieldProps<FieldValue>) {
  const [editorValue, setEditorValue] = useState(() => codec.format(value));
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const onErrorChangeRef = useRef(onErrorChange);

  useEffect(() => {
    onErrorChangeRef.current = onErrorChange;
  });

  useEffect(() => {
    return () => onErrorChangeRef.current?.(false);
  }, []);

  function handleChange(next: string) {
    setEditorValue(next);
    const result = codec.parse(next);
    if (result.success) {
      setErrorMessage(undefined);
      onErrorChange?.(false);
      onChange(result.data);
    } else {
      setErrorMessage(result.message);
      onErrorChange?.(true);
    }
  }

  return (
    <div css={fieldContainerCSS}>
      <div css={fieldBaseCSS}>
        <Label>{label}</Label>
        <CodeWrap>
          <JSONEditor
            value={editorValue}
            onChange={handleChange}
            jsonSchema={jsonSchema}
            optionalLint
            placeholder={placeholder}
          />
        </CodeWrap>
        {errorMessage ? (
          <Text slot="errorMessage" color="danger">
            {errorMessage}
          </Text>
        ) : (
          <Text slot="description">{description}</Text>
        )}
      </div>
    </div>
  );
}

/**
 * Editor text considered "empty" by both built-in JSON-object fields:
 * unsubmitted defaults from the JSONEditor, plus a couple of variants users
 * commonly leave behind after clearing the field.
 */
export const EMPTY_JSON_OBJECT_EDITOR_STATES = ["", "{}", "{\n  \n}"] as const;

export function isEmptyJSONObjectEditorState(raw: string): boolean {
  return (EMPTY_JSON_OBJECT_EDITOR_STATES as readonly string[]).includes(
    raw.trim()
  );
}
