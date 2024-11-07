import React, { useCallback, useState } from "react";
import { JSONSchema7 } from "json-schema";

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
} from "./constants";
import { jsonObjectSchema, openAIResponseFormatJSONSchema } from "./schemas";
import { PlaygroundInstanceProps } from "./types";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const RESPONSE_FORMAT_EDITOR_PRE_INIT_HEIGHT = 400;

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
    (p) => p.invocationName === RESPONSE_FORMAT_PARAM_NAME
  );

  const [responseFormatDefinition, setResponseFormatDefinition] = useState(
    JSON.stringify(responseFormat?.valueJson ?? {}, null, 2)
  );

  const onChange = useCallback(
    (value: string) => {
      setResponseFormatDefinition(value);
      const { json: format } = safelyParseJSON(value);
      if (format == null) {
        return;
      }
      // Don't use data here returned by safeParse, as we want to allow for extra keys,
      // there is no "deepPassthrough" to allow for extra keys
      // at all levels of the schema, so we just use the json parsed value here,
      // knowing that it is valid with potentially extra keys
      const { success } = jsonObjectSchema.safeParse(format);
      if (!success) {
        return;
      }
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
    <Accordion arrowPosition="start">
      <AccordionItem id="response-format" title="Output Schema">
        <View padding="size-200">
          <Card
            variant="compact"
            title={
              <Flex direction="row" gap="size-100">
                {/* <SpanKindIcon spanKind="responseFormat" /> */}
                <Text>Schema</Text>
              </Flex>
            }
            bodyStyle={{ padding: 0 }}
            extra={
              <Flex direction="row" gap="size-100">
                <CopyToClipboardButton text={responseFormatDefinition} />
                <Button
                  aria-label="Delete Output Schema"
                  icon={<Icon svg={<Icons.TrashOutline />} />}
                  variant="default"
                  size="compact"
                  onClick={() => {
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
                value={responseFormatDefinition}
                onChange={onChange}
                jsonSchema={openAIResponseFormatJSONSchema as JSONSchema7}
              />
            </LazyEditorWrapper>
          </Card>
        </View>
      </AccordionItem>
    </Accordion>
  );
}
