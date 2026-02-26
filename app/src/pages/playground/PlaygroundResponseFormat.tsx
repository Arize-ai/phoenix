import type { JSONSchema7 } from "json-schema";
import { useCallback, useMemo, useRef } from "react";

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
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
} from "./constants";
import { openAIResponseFormatJSONSchema } from "./schemas";
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
  const deleteInvocationParameterInput = usePlaygroundContext(
    (state) => state.deleteInvocationParameterInput
  );
  const instance = usePlaygroundContext((state) =>
    state.instances.find((i) => i.id === playgroundInstanceId)
  );
  const upsertInvocationParameterInput = usePlaygroundContext(
    (state) => state.upsertInvocationParameterInput
  );

  if (!instance) {
    throw new Error(`Instance ${playgroundInstanceId} not found`);
  }

  const responseFormat = instance.model.invocationParameters.find(
    (p) =>
      p.invocationName === RESPONSE_FORMAT_PARAM_NAME ||
      p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME
  );
  const store = usePlaygroundStore();
  const initialResponseFormatDefinition = useMemo(() => {
    const state = store.getState();
    const latestInstance = state.instances.find(
      (i) => i.id === playgroundInstanceId
    );
    if (latestInstance != null) {
      const latestResponseFormat =
        latestInstance.model.invocationParameters.find(
          (p) =>
            p.invocationName === RESPONSE_FORMAT_PARAM_NAME ||
            p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME
        );
      if (latestResponseFormat != null) {
        return JSON.stringify(latestResponseFormat.valueJson, null, 2);
      }
    }
    return JSON.stringify(responseFormat?.valueJson ?? {}, null, 2);
  }, [playgroundInstanceId, responseFormat?.valueJson, store]);
  const currentValueRef = useRef(initialResponseFormatDefinition);

  currentValueRef.current = initialResponseFormatDefinition;

  const onChange = useCallback(
    (value: string) => {
      // track the current value of the editor, even when it is invalid
      currentValueRef.current = value;
      const { json: format } = safelyParseJSON(value);
      upsertInvocationParameterInput({
        instanceId: playgroundInstanceId,
        invocationParameterInput: {
          invocationName: RESPONSE_FORMAT_PARAM_NAME,
          valueJson: format,
          canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        },
      });
    },
    [playgroundInstanceId, upsertInvocationParameterInput]
  );

  return (
    <Card
      title="Response Format"
      collapsible
      extra={
        <Flex direction="row" gap="size-100">
          <CopyToClipboardButton text={currentValueRef} />
          <Button
            aria-label="Delete Response Format"
            leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
            size="S"
            onPress={() => {
              deleteInvocationParameterInput({
                instanceId: playgroundInstanceId,
                invocationParameterInputInvocationName:
                  RESPONSE_FORMAT_PARAM_NAME,
              });
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
          jsonSchema={openAIResponseFormatJSONSchema as JSONSchema7}
        />
      </LazyEditorWrapper>
    </Card>
  );
}
