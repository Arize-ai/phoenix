import { useCallback, useEffect, useRef, useState } from "react";
import { JSONSchema7 } from "json-schema";

import { Card } from "@arizeai/components";

import {
  Button,
  CopyToClipboardButton,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
} from "./constants";
import { openAIResponseFormatJSONSchema } from "./schemas";
import { PlaygroundInstanceProps } from "./types";

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
  const instanceProvider = instance?.model.provider;
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
  const [initialResponseFormatDefinition, setInitialResponseFormatDefinition] =
    useState(() => JSON.stringify(responseFormat?.valueJson ?? {}, null, 2));
  const currentValueRef = useRef(initialResponseFormatDefinition);
  const store = usePlaygroundStore();

  // when the instance provider changes, we need to update the editor value
  // to reflect the new response format schema
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const responseFormat = instance.model.invocationParameters.find(
      (p) =>
        p.invocationName === RESPONSE_FORMAT_PARAM_NAME ||
        p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME
    );
    if (responseFormat == null) {
      return;
    }
    const newResponseFormatDefinition = JSON.stringify(
      responseFormat.valueJson,
      null,
      2
    );
    if (isJSONString({ str: newResponseFormatDefinition, excludeNull: true })) {
      setInitialResponseFormatDefinition(newResponseFormatDefinition);
    }
  }, [instanceProvider, store, playgroundInstanceId]);

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
    <Disclosure id="response-format">
      <DisclosureTrigger arrowPosition="start">
        Response Format
      </DisclosureTrigger>
      <DisclosurePanel>
        <View padding="size-200">
          <Card
            variant="compact"
            title="Schema"
            bodyStyle={{ padding: 0 }}
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
              preInitializationMinHeight={
                RESPONSE_FORMAT_EDITOR_PRE_INIT_HEIGHT
              }
            >
              <JSONEditor
                value={initialResponseFormatDefinition}
                onChange={onChange}
                jsonSchema={openAIResponseFormatJSONSchema as JSONSchema7}
              />
            </LazyEditorWrapper>
          </Card>
        </View>
      </DisclosurePanel>
    </Disclosure>
  );
}
