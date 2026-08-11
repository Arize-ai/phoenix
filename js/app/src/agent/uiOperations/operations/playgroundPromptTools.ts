import {
  readPromptToolsInputSchema,
  writePromptToolsInputSchema,
} from "@phoenix/agent/tools/playgroundPromptTools/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/** Route hint shared by every playground operation. */
const PLAYGROUND_ROUTE_HINT =
  "the Prompt Playground page (a /playground route)";

/**
 * The catalog entry replacing the `read_prompt_tools` client-action tool.
 * The input schema is reused from the existing tool module; the description
 * moves here verbatim from the Python `DESCRIPTION` with tool names updated
 * to operation names.
 */
export const readPromptToolsOperation = defineUiOperation({
  name: "playground.prompt.tools.read",
  description:
    "Read the function/tool definitions attached to one playground prompt instance. " +
    "Returns the list of tools (id, name, description, parameters JSON Schema, strict flag) " +
    "and a `revision` token. Always call this before `playground.prompt.tools.write` and pass the " +
    "returned `revision` back as `expectedRevision`; stale writes are rejected if the " +
    "tool list changed in between. " +
    "If there is exactly one playground instance, `instanceId` may be omitted. If there " +
    "are multiple comparison instances, pass the specific `instanceId`. Vendor passthrough " +
    'tools (e.g. provider builtins like `web_search`) are surfaced with `kind: "raw"` ' +
    "and an opaque `raw` blob; only function tools can be written via `playground.prompt.tools.write`.",
  inputSchema: readPromptToolsInputSchema,
  kind: "read",
  defaultSuccessOutput: "Prompt tools read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `write_prompt_tools` client-action tool.
 * Writing tools is an approval operation: the browser stages the batch as a
 * pending change the user must accept or reject.
 */
export const writePromptToolsOperation = defineUiOperation({
  name: "playground.prompt.tools.write",
  description:
    "Create, update, and/or delete function/tool definitions on a playground prompt " +
    "instance in a single atomic batch. " +
    "Always call `playground.prompt.tools.read` first and pass its `revision` as `expectedRevision`; " +
    "the whole batch is rejected if the tool list changed since that read. " +
    "Within each entry of `tools`, pass `id` to update an existing function tool (patch — " +
    "only fields present in the entry change); omit `id` or pass null to create a new one " +
    "(the runtime assigns the id). Each entry's `name` is always required. `parameters` is " +
    "a JSON Schema object describing the function arguments. " +
    "`deleteToolIds` is a list of tool ids to remove; unlike writes, deletes may target " +
    "either function tools or vendor passthrough (raw) tools, since removing a tool needs " +
    "no knowledge of its shape. Provide at least one of `tools` or `deleteToolIds`. " +
    "The batch is all-or-nothing: if any entry references a missing id, a raw tool on the " +
    "write path, or the same id in both `tools` and `deleteToolIds`, nothing is applied and " +
    "the error explains which. Deleting the tool that is the forced tool choice succeeds: the " +
    "tool choice is reset to auto (zero-or-more) and the result reports `resetToolChoiceFrom` " +
    "with that tool's name — surface this to the user. " +
    "Common valid examples: " +
    'create two: {"instanceId":1,"expectedRevision":"prompt-tools-abc","tools":[' +
    '{"name":"get_weather","description":"Look up the current weather for a city",' +
    '"parameters":{"type":"object","properties":{"city":{"type":"string"}},' +
    '"required":["city"]}},' +
    '{"name":"get_forecast","parameters":{"type":"object","properties":' +
    '{"city":{"type":"string"},"days":{"type":"integer"}},"required":["city","days"]}}]}; ' +
    'create one and update another: {"instanceId":1,"expectedRevision":"prompt-tools-abc",' +
    '"tools":[{"name":"get_time","parameters":{"type":"object","properties":' +
    '{"timezone":{"type":"string"}},"required":["timezone"]}},' +
    '{"id":3,"name":"get_weather","parameters":{"type":"object","properties":' +
    '{"city":{"type":"string"},"units":{"type":"string","enum":["c","f"]}},' +
    '"required":["city"]}}]}; ' +
    'delete one and add another in one batch: {"instanceId":1,' +
    '"expectedRevision":"prompt-tools-abc","deleteToolIds":[3],' +
    '"tools":[{"name":"get_forecast","parameters":{"type":"object","properties":' +
    '{"city":{"type":"string"}},"required":["city"]}}]}; ' +
    'delete only: {"instanceId":1,"expectedRevision":"prompt-tools-abc","deleteToolIds":[3,4]}. ' +
    "This tool only writes function tools; it does not author vendor passthrough tools " +
    '(those appear in `playground.prompt.tools.read` with `kind: "raw"`), though it can delete them.',
  inputSchema: writePromptToolsInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Prompt tools updated.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground prompt-tools operations, for catalog assembly. */
export const playgroundPromptToolsOperations: UiOperationDescriptor[] = [
  readPromptToolsOperation,
  writePromptToolsOperation,
];
