import { useEffect, useRef } from "react";

import {
  applyDraftOperations,
  createEditAnnotationConfigDraftClientAction,
  createReadAnnotationConfigDraftClientAction,
  EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
  READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
  type AnnotationConfigDraftHost,
  type AnnotationConfigDraftSnapshot,
  type EditAnnotationConfigDraftOperation,
} from "@phoenix/agent/tools/annotationConfigDraft";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useAnnotationConfigDraftStoreInstance } from "@phoenix/contexts/AnnotationConfigDraftContext";

/**
 * Wires the open annotation-config form up to the agent: builds a draft host
 * backed by the live draft store, then registers the read/edit client actions
 * for the agent to drive. Edits apply directly to the draft (no approval diff
 * card). The actions are unregistered on unmount, so they only resolve while a
 * form is mounted — which is also when the server advertises the matching
 * `annotation_config`-gated tools.
 */
export const useAnnotationConfigDraftRegistration = () => {
  const store = useAnnotationConfigDraftStoreInstance();
  const agentStore = useAgentStore();
  const draftHostRef = useRef<AnnotationConfigDraftHost | null>(null);

  useEffect(() => {
    const buildSnapshot = (): AnnotationConfigDraftSnapshot => {
      const state = store.getState();
      return {
        mode: state.mode,
        annotationConfigNodeId: state.configId,
        ...state.draft,
      };
    };

    const previewOperations = (
      snapshot: AnnotationConfigDraftSnapshot,
      operations: EditAnnotationConfigDraftOperation[]
    ) => applyDraftOperations({ snapshot, operations });

    const applyOperations = (operations: EditAnnotationConfigDraftOperation[]) => {
      const current = buildSnapshot();
      const proposed = previewOperations(current, operations);
      if (!proposed.ok) return proposed;
      const next = proposed.output;
      store.getState().replaceDraft({
        annotationType: next.annotationType,
        name: next.name,
        description: next.description,
        optimizationDirection: next.optimizationDirection,
        values: next.values,
        lowerBound: next.lowerBound,
        upperBound: next.upperBound,
      });
      return { ok: true as const, output: buildSnapshot() };
    };

    const host: AnnotationConfigDraftHost = {
      getSnapshot: buildSnapshot,
      previewOperations,
      applyOperations,
    };
    draftHostRef.current = host;

    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    const getDraftHost = () => draftHostRef.current;
    registerClientAction(
      READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
      createReadAnnotationConfigDraftClientAction({ getDraftHost })
    );
    registerClientAction(
      EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
      createEditAnnotationConfigDraftClientAction({ getDraftHost })
    );
    return () => {
      draftHostRef.current = null;
      unregisterClientAction(READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME);
      unregisterClientAction(EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME);
    };
  }, [agentStore, store]);
};
