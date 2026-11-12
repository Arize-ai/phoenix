import { useContext, useEffect, useRef } from "react";

import {
  createEvaluatorHostSubmit,
  type EvaluatorSubmitResult,
} from "@phoenix/agent/tools/approval";
import {
  createEditProjectEvaluatorAttachClientAction,
  createReadProjectEvaluatorAttachClientAction,
  createSubmitProjectEvaluatorAttachClientAction,
  type ProjectEvaluatorAttachHost,
} from "@phoenix/agent/tools/projectEvaluatorAttach";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editProjectEvaluatorAttachOperation,
  readProjectEvaluatorAttachOperation,
  submitProjectEvaluatorAttachOperation,
} from "@phoenix/agent/uiOperations/operations/projectEvaluator";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { isSameInputMapping } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type ProjectEvaluatorAttachTarget = {
  evaluatorId: string;
  name: string;
  kind: "CODE" | "DECISION";
  variables: readonly string[];
  requiredVariables: readonly string[];
  inputDescriptions?: Record<string, string>;
};

/**
 * Lets PXI read and change what an attach form will save, and attach it.
 * Attaching keeps the evaluator's definition, so the only part of the
 * evaluator a project sets is its input mapping, which lives in the
 * evaluator store as on the other forms; the scope and test bench have
 * their own operations.
 */
export function useProjectEvaluatorAttachRegistration({
  target,
  submit,
}: {
  target: ProjectEvaluatorAttachTarget;
  submit: () => Promise<EvaluatorSubmitResult>;
}) {
  const agentStore = useContext(AgentContext);
  const store = useEvaluatorStoreInstance();
  const latestRef = useRef({ target, submit });
  // eslint-disable-next-line react/refs
  latestRef.current = { target, submit };
  const { evaluatorId } = target;
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    const openedWith = store.getState().evaluator.inputMapping;
    let host: ProjectEvaluatorAttachHost | null = {
      getSnapshot: () => {
        const { target: current } = latestRef.current;
        const { inputMapping } = store.getState().evaluator;
        return {
          evaluatorId: current.evaluatorId,
          name: current.name,
          kind: current.kind,
          variables: [...current.variables],
          requiredVariables: [...current.requiredVariables],
          inputDescriptions: current.inputDescriptions ?? {},
          inputMapping,
          isDefaultMapping: isSameInputMapping(inputMapping, openedWith),
        };
      },
      applyInputMapping: (inputMapping) => {
        const state = store.getState();
        if (!isSameInputMapping(state.evaluator.inputMapping, inputMapping)) {
          // Replaced, not set, so the mapping rows rebuild from it.
          state.replaceInputMapping(inputMapping);
        }
      },
      submit: createEvaluatorHostSubmit({
        getHandleSubmit: () => latestRef.current.submit,
        unmountedError: "The attach form is not mounted; cannot attach.",
      }),
    };
    const getHost = () => host;
    const shouldAutoAccept = () =>
      agentStore.getState().permissions.edits === "bypass";
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readProjectEvaluatorAttachOperation,
          handler: createReadProjectEvaluatorAttachClientAction({ getHost }),
        },
        {
          descriptor: editProjectEvaluatorAttachOperation,
          handler: createEditProjectEvaluatorAttachClientAction({
            getHost,
            shouldAutoAccept,
          }),
        },
        {
          descriptor: submitProjectEvaluatorAttachOperation,
          handler: createSubmitProjectEvaluatorAttachClientAction({
            getHost,
            shouldAutoAccept,
          }),
        },
      ],
    });
    return () => {
      host = null;
      unregister();
    };
  }, [agentStore, store, evaluatorId]);
}
