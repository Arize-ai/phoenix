import {
  createAnnotationConfigOperation,
  updateAnnotationConfigOperation,
} from "@phoenix/agent/uiOperations/operations/annotationConfig";
import type { UIOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { toAnnotationConfigDraft } from "./buildAnnotationConfigInput";
import { commitCreateAnnotationConfig } from "./createAnnotationConfig";
import { stageAnnotationConfigWriteOperation } from "./pendingAnnotationConfigWrite";
import type {
  CreateAnnotationConfigInput,
  UpdateAnnotationConfigInput,
} from "./types";
import { commitUpdateAnnotationConfig } from "./updateAnnotationConfig";

/** Handler for the `annotationConfig.create` operation. */
export function createCreateAnnotationConfigClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UIOperationHandler<CreateAnnotationConfigInput> {
  return (input, context) => {
    const draft = toAnnotationConfigDraft(input);
    return stageAnnotationConfigWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: createAnnotationConfigOperation.name,
        preview: { kind: "create", draft, projectId: input.projectId ?? null },
      },
      apply: () => commitCreateAnnotationConfig(draft, input.projectId ?? null),
      agentStore,
    });
  };
}

/**
 * Handler for the `annotationConfig.update` operation: a full replace — the
 * shared card carries the labels-not-included-are-removed warning.
 */
export function createUpdateAnnotationConfigClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UIOperationHandler<UpdateAnnotationConfigInput> {
  return (input, context) => {
    const draft = toAnnotationConfigDraft(input);
    return stageAnnotationConfigWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: updateAnnotationConfigOperation.name,
        preview: { kind: "update", configId: input.id, draft },
      },
      apply: () => commitUpdateAnnotationConfig(input.id, draft),
      agentStore,
    });
  };
}
