import type { DynamicToolUIPart, UIMessage } from "ai";

/**
 * Synthetic tool name used to signal permission changes to the model via
 * injected messages. This tool is **never** advertised in the tools array
 * sent to the model, so the model cannot call it. If a model somehow emits
 * a call with this name (e.g. hallucination), the handler rejects it.
 */
export const PERMISSIONS_TOOL_NAME = "update_permissions";

type PermissionKey = "dangerouslyEnableMutations";

/**
 * Build an assistant {@link UIMessage} containing a synthetic
 * `update_permissions` tool invocation with its result already resolved.
 *
 * When appended to the chat history via `setMessages`, this message tells
 * the model that certain runtime permissions have changed. The
 * `sendAutomaticallyWhen` callback detects the completed tool call and
 * automatically sends the conversation so the model can acknowledge the
 * change.
 *
 * @param permission - Which permission was toggled.
 * @param enabled    - Whether the permission is now on or off.
 */
export function buildPermissionsUpdateMessage({
  permission,
  enabled,
}: {
  permission: PermissionKey;
  enabled: boolean;
}): UIMessage {
  const toolCallId = `perm-${permission}-${Date.now()}`;

  const descriptions: Record<PermissionKey, { on: string; off: string }> = {
    dangerouslyEnableMutations: {
      on: "GraphQL mutations are now ENABLED. The phoenix-gql CLI tool can execute mutation operations in addition to queries. The schema introspection in /phoenix/graphql/schema.json already includes mutation types.",
      off: "GraphQL mutations are now DISABLED. The phoenix-gql CLI tool is restricted to read-only queries. Mutation and subscription operations will be rejected.",
    },
  };

  const description = enabled
    ? descriptions[permission].on
    : descriptions[permission].off;

  const toolPart: DynamicToolUIPart = {
    type: "dynamic-tool",
    toolName: PERMISSIONS_TOOL_NAME,
    toolCallId,
    state: "output-available",
    input: { permission, enabled },
    output: description,
  };

  return {
    id: toolCallId,
    role: "assistant",
    parts: [toolPart],
  };
}
