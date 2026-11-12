import { useContext, useEffect, useRef } from "react";

import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import {
  applyDraftOperations,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  createSubmitCodeEvaluatorDraftClientAction,
  type EditCodeEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  fromOutputConfigDraft,
  type SandboxConfigIndex,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editCodeEvaluatorDraftOperation,
  readCodeEvaluatorDraftOperation,
  submitCodeEvaluatorDraftOperation,
} from "@phoenix/agent/uiOperations/operations/codeEvaluatorDraft";
import type { SandboxConfigOption } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

export type ProjectCodeEvaluatorFields = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
};

/**
 * Operations a project code form refuses, with the reason the agent reads.
 * The test payload is the bench's focused record there, not a hand-written
 * case, and a saved evaluator keeps its language.
 */
export function getProjectCodeDraftOperationError({
  operations,
  isLanguageEditable,
}: {
  operations: EditCodeEvaluatorDraftOperation[];
  isLanguageEditable: boolean;
}): string | null {
  for (const operation of operations) {
    if (operation.type === "set_test_payload") {
      return (
        "set_test_payload does not apply to a project evaluator form: its " +
        "test cases are real records. Test with evaluators.project.bench.run."
      );
    }
    if (operation.type === "set_language" && !isLanguageEditable) {
      return "This form edits a saved code evaluator, whose language cannot change.";
    }
  }
  return null;
}

/**
 * Lets PXI read, edit, and save the open project code evaluator form (create
 * or edit). The source, language, and sandbox live in the form's own state;
 * the name, description, output configs, and input mapping in the evaluator
 * store, as in the dataset form. Testing goes through the bench operations.
 */
export function useProjectCodeEvaluatorDraftRegistration({
  mode,
  evaluatorNodeId,
  fields,
  setSourceCode,
  setLanguage,
  setSandboxConfigId,
  sandboxConfigs,
  submit,
}: {
  mode: "create" | "edit";
  /** The saved code evaluator, on an edit form. */
  evaluatorNodeId: string | null;
  fields: ProjectCodeEvaluatorFields;
  setSourceCode: (sourceCode: string) => void;
  /** Absent when the language cannot change. */
  setLanguage?: (language: CodeEvaluatorLanguage) => void;
  setSandboxConfigId: (sandboxConfigId: string | null) => void;
  sandboxConfigs: readonly SandboxConfigOption[];
  submit: () => Promise<EvaluatorSubmitResult>;
}) {
  const agentStore = useContext(AgentContext);
  const store = useEvaluatorStoreInstance();
  const latestRef = useRef({
    fields,
    setSourceCode,
    setLanguage,
    setSandboxConfigId,
    sandboxConfigs,
    submit,
  });
  // eslint-disable-next-line react/refs
  latestRef.current = {
    fields,
    setSourceCode,
    setLanguage,
    setSandboxConfigId,
    sandboxConfigs,
    submit,
  };
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    const buildSnapshot = (): CodeEvaluatorDraftSnapshot => {
      const { fields: current, sandboxConfigs: configs } = latestRef.current;
      const state = store.getState();
      return {
        mode,
        evaluatorNodeId,
        name: state.evaluator.globalName,
        description: state.evaluator.description,
        language: current.language,
        sourceCode: current.sourceCode,
        sandboxConfigId: current.sandboxConfigId,
        inputMapping: state.evaluator.inputMapping,
        testPayload: state.evaluatorMappingSource.source,
        outputConfigs: toOutputConfigDrafts(state.outputConfigs),
        availableSandboxConfigs: configs.map((config) => ({
          id: config.id,
          name: config.name,
          language: config.language,
          backendType: config.backendType,
        })),
      };
    };
    const previewOperations = (
      snapshot: CodeEvaluatorDraftSnapshot,
      operations: EditCodeEvaluatorDraftOperation[]
    ) => {
      const error = getProjectCodeDraftOperationError({
        operations,
        isLanguageEditable: latestRef.current.setLanguage != null,
      });
      if (error) {
        return { ok: false as const, error };
      }
      const sandboxConfigIndex: SandboxConfigIndex = Object.fromEntries(
        latestRef.current.sandboxConfigs.map((config) => [
          config.id,
          { language: config.language },
        ])
      );
      return applyDraftOperations({
        snapshot,
        operations,
        sandboxConfigs: sandboxConfigIndex,
      });
    };
    const applyOperations = (operations: EditCodeEvaluatorDraftOperation[]) => {
      const current = buildSnapshot();
      const proposed = previewOperations(current, operations);
      if (!proposed.ok) return proposed;
      const next = proposed.output;
      const setters = latestRef.current;
      // Written to the ref too, so the snapshot returned below, and a second
      // edit in the same script, see the new values before the form renders.
      latestRef.current = {
        ...latestRef.current,
        fields: {
          language: next.language,
          sourceCode: next.sourceCode,
          sandboxConfigId: next.sandboxConfigId,
        },
      };
      if (next.sourceCode !== current.sourceCode) {
        setters.setSourceCode(next.sourceCode);
      }
      if (next.language !== current.language) {
        setters.setLanguage?.(next.language);
      }
      if (next.sandboxConfigId !== current.sandboxConfigId) {
        setters.setSandboxConfigId(next.sandboxConfigId);
      }
      const state = store.getState();
      if (next.name !== current.name) {
        state.setEvaluatorGlobalName(next.name);
        state.setEvaluatorName(next.name);
      }
      if (next.description !== current.description) {
        state.setEvaluatorDescription(next.description);
      }
      if (
        JSON.stringify(next.outputConfigs) !==
        JSON.stringify(current.outputConfigs)
      ) {
        state.setOutputConfigs(next.outputConfigs.map(fromOutputConfigDraft));
      }
      if (
        JSON.stringify(next.inputMapping) !==
        JSON.stringify(current.inputMapping)
      ) {
        // Replaced, not set, so the mapping rows rebuild from it.
        state.replaceInputMapping(next.inputMapping);
      }
      return { ok: true as const, output: buildSnapshot() };
    };
    let host: CodeEvaluatorDraftHost | null = {
      getSnapshot: buildSnapshot,
      previewOperations,
      applyOperations,
      submit: createEvaluatorHostSubmit({
        getHandleSubmit: () => latestRef.current.submit,
        unmountedError:
          "The project code-evaluator form is not mounted; cannot submit.",
      }),
    };
    const getDraftHost = () => host;
    const shouldAutoAccept = () =>
      agentStore.getState().permissions.edits === "bypass";
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readCodeEvaluatorDraftOperation,
          handler: createReadCodeEvaluatorDraftClientAction({ getDraftHost }),
        },
        {
          descriptor: editCodeEvaluatorDraftOperation,
          handler: createEditCodeEvaluatorDraftClientAction({
            getDraftHost,
            setPendingCodeEvaluatorEdit:
              agentStore.getState().setPendingCodeEvaluatorEdit,
            shouldAutoAccept,
          }),
        },
        {
          descriptor: submitCodeEvaluatorDraftOperation,
          handler: createSubmitCodeEvaluatorDraftClientAction({
            getDraftHost,
            shouldAutoAccept,
          }),
        },
      ],
    });
    return () => {
      host = null;
      unregister();
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingCodeEvaluatorEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
    };
  }, [agentStore, store, mode, evaluatorNodeId]);
}

/** The registration as an element, for forms that create their evaluator store inline. */
export function ProjectCodeEvaluatorDraftRegistration(
  props: Parameters<typeof useProjectCodeEvaluatorDraftRegistration>[0]
) {
  useProjectCodeEvaluatorDraftRegistration(props);
  return null;
}
