import { Button, Icon, Icons } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type {
  CanonicalResponseFormat,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

import { createTool } from "./playgroundUtils";

const DEFAULT_RESPONSE_FORMAT: CanonicalResponseFormat = {
  type: "json_schema",
  jsonSchema: {
    name: "response",
    schema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Adds a JSON schema response format to an instance; disabled once it has one.
 */
export function AddResponseFormatButton({
  instanceId,
}: {
  instanceId: number;
}) {
  const setResponseFormat = usePlaygroundContext(
    (state) => state.setResponseFormat
  );
  const model = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
  );
  if (!model) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const hasResponseFormat = model.responseFormat != null;
  const usesResponseSchemaName =
    model.provider === "GOOGLE" || model.provider === "AWS";
  return (
    <Button
      size="S"
      aria-label="response format"
      data-testid="add-response-format"
      leadingVisual={<Icon svg={<Icons.Plus />} />}
      isDisabled={hasResponseFormat}
      onPress={() => {
        setResponseFormat({
          instanceId,
          responseFormat: DEFAULT_RESPONSE_FORMAT,
        });
      }}
    >
      {usesResponseSchemaName ? "Response Schema" : "Response Format"}
    </Button>
  );
}

/**
 * Adds a new tool definition to an instance.
 */
export function AddToolButton({ instanceId }: { instanceId: number }) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const tools = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.tools
  );
  if (!tools) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  return (
    <Button
      aria-label="add tool"
      size="S"
      leadingVisual={<Icon svg={<Icons.Plus />} />}
      onPress={() => {
        const patch: Partial<PlaygroundNormalizedInstance> = {
          tools: [
            ...tools,
            createTool({
              toolNumber: tools.length + 1,
            }),
          ],
        };
        if (tools.length === 0) {
          patch.toolChoice = { type: "ZERO_OR_MORE" };
        }
        updateInstance({
          instanceId,
          patch,
          dirty: true,
        });
      }}
    >
      Tool
    </Button>
  );
}
