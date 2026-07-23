import type { JSONSchema7 } from "json-schema";
import { useCallback } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { readInvocationConfigField } from "@phoenix/pages/playground/providerAdapters";
import type { PlaygroundNormalizedInstance } from "@phoenix/store";
import { isObject, isStringKeyedObject } from "@phoenix/typeUtils";

import type { JSONObjectFieldCodec } from "./JSONObjectModelConfigFormField";
import {
  isEmptyJSONObjectEditorState,
  JSONObjectModelConfigFormField,
} from "./JSONObjectModelConfigFormField";

const EXTRA_BODY_JSON_SCHEMA: JSONSchema7 = {
  type: "object",
  additionalProperties: true,
};

const extraBodyCodec: JSONObjectFieldCodec<Record<string, unknown>> = {
  format: (value) => {
    if (
      !isObject(value) ||
      Array.isArray(value) ||
      Object.keys(value).length === 0
    ) {
      return "{\n  \n}";
    }
    return JSON.stringify(value, null, 2);
  },
  parse: (raw) => {
    if (isEmptyJSONObjectEditorState(raw)) {
      return { success: true, data: undefined };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isStringKeyedObject(parsed) || Array.isArray(parsed)) {
        return { success: false, message: "Extra Body must be a JSON object" };
      }
      return {
        success: true,
        data: Object.keys(parsed).length > 0 ? parsed : undefined,
      };
    } catch {
      return { success: false, message: "Invalid JSON format" };
    }
  },
};

export function ExtraBodyModelConfigFormField({
  instance,
  onErrorChange,
}: {
  instance: PlaygroundNormalizedInstance;
  onErrorChange?: (hasError: boolean) => void;
}) {
  const setInvocationParameterField = usePlaygroundContext(
    (state) => state.setInvocationParameterField
  );
  const extraBody = readInvocationConfigField(
    instance.model.provider,
    instance.model.invocationParameters,
    "extraBody"
  );

  const handleChange = useCallback(
    (next: Record<string, unknown> | undefined) => {
      setInvocationParameterField({
        instanceId: instance.id,
        fieldName: "extraBody",
        value: next,
      });
    },
    [instance.id, setInvocationParameterField]
  );

  return (
    <JSONObjectModelConfigFormField
      label="Extra Body"
      description="Additional provider-specific options."
      placeholder={`{"provider_specific_option": true}`}
      jsonSchema={EXTRA_BODY_JSON_SCHEMA}
      value={isStringKeyedObject(extraBody) ? extraBody : undefined}
      codec={extraBodyCodec}
      onChange={handleChange}
      onErrorChange={onErrorChange}
    />
  );
}
