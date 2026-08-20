import type { JSONSchema7 } from "json-schema";
import { useCallback, useRef, useState } from "react";

import {
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { jsonSchemaZodSchema } from "@phoenix/schemas";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import {
  displayToCanonicalResponseFormat,
  getResponseFormatDisplay,
} from "./playgroundUtils";
import {
  anthropicResponseFormatJSONSchema,
  openAIResponseFormatJSONSchema,
} from "./schemas";
import type { PlaygroundInstanceProps } from "./types";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const RESPONSE_FORMAT_EDITOR_PRE_INIT_HEIGHT = 400;

/**
 * This component is uncontrolled once the initial value is provided.
 * To reset the value in response to external changes, the parent must
 * provide a new key prop.
 */
export function PlaygroundResponseFormat({
  playgroundInstanceId,
}: PlaygroundInstanceProps) {
  const deleteResponseFormat = usePlaygroundContext(
    (state) => state.deleteResponseFormat
  );
  const setResponseFormat = usePlaygroundContext(
    (state) => state.setResponseFormat
  );
  const instance = usePlaygroundContext((state) =>
    state.instances.find((i) => i.id === playgroundInstanceId)
  );
  const instanceProvider = instance?.model.provider;

  if (!instance) {
    throw new Error(`Instance ${playgroundInstanceId} not found`);
  }

  const initialResponseFormatDefinition = JSON.stringify(
    getResponseFormatDisplay(instance.model) ?? {},
    null,
    2
  );
  const currentValueRef = useRef(initialResponseFormatDefinition);

  const onChange = useCallback(
    (value: string) => {
      currentValueRef.current = value;
      const { json: display } = safelyParseJSON(value);
      if (!instanceProvider) return;
      const canonical = displayToCanonicalResponseFormat(
        display,
        instanceProvider
      );
      if (canonical) {
        setResponseFormat({
          instanceId: playgroundInstanceId,
          responseFormat: canonical,
        });
      }
    },
    [playgroundInstanceId, setResponseFormat, instanceProvider]
  );

  const label =
    instanceProvider === "GOOGLE" || instanceProvider === "AWS"
      ? "Response Schema"
      : "Response Format";

  return (
    <Card
      title={label}
      collapsible
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={currentValueRef} />
          <Button
            aria-label={`Delete ${label}`}
            leadingVisual={<Icon svg={<Icons.Trash />} />}
            size="S"
            onPress={() => {
              deleteResponseFormat({ instanceId: playgroundInstanceId });
            }}
          />
        </Flex>
      }
    >
      <LazyEditorWrapper
        preInitializationMinHeight={RESPONSE_FORMAT_EDITOR_PRE_INIT_HEIGHT}
        data-testid="playground-response-format-editor"
      >
        <UncontrolledResponseFormatEditor
          key={instanceProvider}
          initialValue={initialResponseFormatDefinition}
          onChange={onChange}
          jsonSchema={
            (instanceProvider === "GOOGLE" || instanceProvider === "AWS"
              ? jsonSchemaZodSchema
              : instanceProvider === "ANTHROPIC"
                ? anthropicResponseFormatJSONSchema
                : openAIResponseFormatJSONSchema) as JSONSchema7
          }
        />
      </LazyEditorWrapper>
    </Card>
  );
}

function UncontrolledResponseFormatEditor({
  initialValue,
  onChange,
  jsonSchema,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  jsonSchema: JSONSchema7;
}) {
  const [value] = useState(initialValue);
  return (
    <JSONEditor value={value} onChange={onChange} jsonSchema={jsonSchema} />
  );
}
