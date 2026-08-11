import { savePromptInputSchema } from "@phoenix/agent/tools/playgroundSavePrompt/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * The catalog entry replacing the `save_prompt` client-action tool. Saving is
 * an approval operation: the browser stages the save and the promise resolves
 * only after the user accepts or rejects it. The input schema is reused from
 * the existing tool module; the description moves here verbatim from the
 * Python `DESCRIPTION`.
 */
export const savePromptOperation = defineUiOperation({
  name: "playground.prompt.save",
  description:
    "Save the active changes for one mounted playground prompt instance. " +
    "Use this only when the user explicitly asks to save the current playground prompt, " +
    "or after they explicitly accept that the current prompt should become a saved prompt " +
    "version. In manual approval mode, the browser asks the user to approve before " +
    "committing the save; approval is bypassed only when edit_permission is bypass. " +
    "If the instance is already associated with a prompt, omit `name` and " +
    "`promptId` to save a new version on that prompt. If the instance is not associated " +
    "with a prompt and `name` is omitted, the browser derives a valid prompt name from " +
    "the current prompt content and creates a new prompt. Pass `name` only when the user " +
    "provided a desired prompt name or explicitly asked to save as a new prompt. Pass " +
    "`promptId` only when saving a new version on a specific existing prompt. Always pass " +
    "a clear, short, concise `description` that states the change or intention. Tags work " +
    "like releases: pass tags only when the user explicitly asks to tag, release, or " +
    "promote this version.",
  inputSchema: savePromptInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Prompt saved.",
  availability: {
    routeHint: "the Prompt Playground page (a /playground route)",
  },
});

/** All save-prompt operations, for catalog assembly. */
export const playgroundSavePromptOperations: UiOperationDescriptor[] = [
  savePromptOperation,
];
