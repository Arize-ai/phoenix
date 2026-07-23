import type { JSONSchema7 } from "json-schema";
import { useCallback } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  httpHeadersJSONSchema,
  stringToHttpHeadersSchema,
} from "@phoenix/schemas/httpHeadersSchema";
import type { PlaygroundNormalizedInstance } from "@phoenix/store";

import type { JSONObjectFieldCodec } from "./JSONObjectModelConfigFormField";
import { JSONObjectModelConfigFormField } from "./JSONObjectModelConfigFormField";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- zod's z.toJSONSchema output and json-schema's JSONSchema7 are structurally compatible at runtime but not assignable across the two libraries' types
const HEADERS_SCHEMA = httpHeadersJSONSchema as JSONSchema7;

const headersCodec: JSONObjectFieldCodec<Record<string, string>> = {
  format: (headers) => {
    if (!headers || Object.keys(headers).length === 0) {
      return "{\n  \n}";
    }
    return JSON.stringify(headers, null, 2);
  },
  parse: (raw) => {
    const result = stringToHttpHeadersSchema.safeParse(raw);
    if (result.success) {
      return { success: true, data: result.data ?? undefined };
    }
    const firstError = result.error.issues[0];
    return {
      success: false,
      message:
        firstError?.message ??
        firstError?.path?.join(".") ??
        "Invalid headers format",
    };
  },
};

export function CustomHeadersModelConfigFormField({
  instance,
  onErrorChange,
}: {
  instance: PlaygroundNormalizedInstance;
  onErrorChange?: (hasError: boolean) => void;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  const handleChange = useCallback(
    (next: Record<string, string> | undefined) => {
      updateModel({
        instanceId: instance.id,
        patch: { customHeaders: next ?? null },
      });
    },
    [instance.id, updateModel]
  );

  return (
    <JSONObjectModelConfigFormField
      label="Custom Headers"
      description="Custom HTTP headers to send with requests to the LLM provider"
      placeholder={`{"X-Custom-Header": "custom-value"}`}
      jsonSchema={HEADERS_SCHEMA}
      value={instance.model.customHeaders ?? undefined}
      codec={headersCodec}
      onChange={handleChange}
      onErrorChange={onErrorChange}
    />
  );
}
