import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useRef, useState } from "react";

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
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { jsonSchemaZodSchema } from "@phoenix/schemas";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

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

  const [initialResponseFormatDefinition, setInitialResponseFormatDefinition] =
    useState(() =>
      JSON.stringify(getResponseFormatDisplay(instance.model) ?? {}, null, 2)
    );
  const currentValueRef = useRef(initialResponseFormatDefinition);
  const store = usePlaygroundStore();

  // when the instance provider changes, re-derive the display value from the canonical form
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const displayValue = getResponseFormatDisplay(instance.model);
    if (displayValue == null) {
      return;
    }
    const newResponseFormatDefinition = JSON.stringify(displayValue, null, 2);
    if (isJSONString({ str: newResponseFormatDefinition, excludeNull: true })) {
      // eslint-disable-next-line react-hooks-js/set-state-in-effect
      setInitialResponseFormatDefinition(newResponseFormatDefinition);
    }
  }, [instanceProvider, store, playgroundInstanceId]);

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
            leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
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
      >
        <JSONEditor
          value={initialResponseFormatDefinition}
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
