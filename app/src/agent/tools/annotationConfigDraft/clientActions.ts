import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  parseEditAnnotationConfigDraftInput,
  parseReadAnnotationConfigDraftInput,
} from "./parsers";
import type { AnnotationConfigDraftHost } from "./types";

export function createReadAnnotationConfigDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => AnnotationConfigDraftHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadAnnotationConfigDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid read_annotation_config_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error:
          "The annotation-config form is not mounted; cannot read the draft.",
      };
    }
    return { ok: true, output: JSON.stringify(host.getSnapshot(), null, 2) };
  };
}

export function createEditAnnotationConfigDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => AnnotationConfigDraftHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseEditAnnotationConfigDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid edit_annotation_config_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error:
          "The annotation-config form is not mounted; cannot edit the draft.",
      };
    }
    // The edit applies directly to the form draft (no approval diff card); the
    // returned snapshot lets the agent confirm the resulting state.
    const result = host.applyOperations(parsed.operations);
    if (!result.ok) return result;
    return { ok: true, output: JSON.stringify(result.output, null, 2) };
  };
}
