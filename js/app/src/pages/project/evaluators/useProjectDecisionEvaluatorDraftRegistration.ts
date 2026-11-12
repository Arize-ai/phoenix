import { useContext, useEffect, useRef } from "react";

import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/approval";
import {
  applyDecisionDraftOperations,
  createEditDecisionEvaluatorDraftClientAction,
  createReadDecisionEvaluatorDraftClientAction,
  createSubmitDecisionEvaluatorDraftClientAction,
  type DecisionEvaluatorDraftHost,
  type DecisionEvaluatorDraftSnapshot,
  formatDecisionDraftErrors,
  toQuestionSnapshot,
} from "@phoenix/agent/tools/decisionEvaluatorDraft";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editDecisionEvaluatorDraftOperation,
  readDecisionEvaluatorDraftOperation,
  submitDecisionEvaluatorDraftOperation,
} from "@phoenix/agent/uiOperations/operations/decisionEvaluatorDraft";
import { DECISION_EVALUATOR_DRAFT_INSTANCE_ID } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import { normalizePolicy } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  type DecisionEvaluatorDraft,
  toDecisionQuestionDefinitionsFromDrafts,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import {
  createDecisionDraft,
  extractDecisionVariables,
  validateDecisionDraft,
} from "@phoenix/pages/playground/decisionUtils";
import { selectPlaygroundInstanceDecisionPrompt } from "@phoenix/store/playground/selectors";

/**
 * Lets PXI read, edit, and save the open project decision-evaluator form
 * (create or edit). The state and questions live in the form's playground
 * store, the scoring policy in the draft hook, the name and mapping in the
 * evaluator store; edits go to each the way the form's own editors write.
 */
export function useProjectDecisionEvaluatorDraftRegistration({
  mode,
  evaluatorNodeId,
  draft,
  submit,
}: {
  mode: "create" | "edit";
  evaluatorNodeId: string | null;
  draft: DecisionEvaluatorDraft;
  submit: () => Promise<EvaluatorSubmitResult>;
}) {
  const agentStore = useContext(AgentContext);
  const store = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const latestRef = useRef({ draft, submit });
  // eslint-disable-next-line react/refs
  latestRef.current = { draft, submit };
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    const readPrompt = () =>
      selectPlaygroundInstanceDecisionPrompt(
        DECISION_EVALUATOR_DRAFT_INSTANCE_ID
      )(playgroundStore.getState()) ?? createDecisionDraft();
    // A policy PXI wrote lands in the hook's state on the next render; until
    // the hook's policy moves off the one it replaced, read PXI's.
    let pending: {
      policy: DecisionEvaluatorDraft["policy"];
      replaced: DecisionEvaluatorDraft["policy"];
    } | null = null;
    const readPolicy = () => {
      const { policy } = latestRef.current.draft;
      return pending && pending.replaced === policy ? pending.policy : policy;
    };
    const buildSnapshot = (): DecisionEvaluatorDraftSnapshot => {
      const playground = playgroundStore.getState();
      const prompt = readPrompt();
      const { templateFormat } = playground;
      const instance = playground.instances.find(
        ({ id }) => id === DECISION_EVALUATOR_DRAFT_INSTANCE_ID
      );
      const state = store.getState();
      const { draft: currentDraft } = latestRef.current;
      const policy = normalizePolicy(
        toDecisionQuestionDefinitionsFromDrafts(prompt.questions),
        readPolicy()
      );
      return {
        mode,
        evaluatorNodeId,
        name: state.evaluator.globalName,
        model: {
          provider: instance?.model.provider ?? "",
          modelName: instance?.model.modelName ?? null,
        },
        templateFormat,
        state: {
          mode: prompt.state.mode,
          template:
            prompt.state.mode === "json"
              ? prompt.state.json
              : prompt.state.text,
        },
        questions: prompt.questions.map(toQuestionSnapshot),
        scoringPolicy: policy,
        variables: [
          ...extractDecisionVariables({ draft: prompt, templateFormat }),
        ],
        inputMapping: state.evaluator.inputMapping,
        definitionErrors: [
          ...(currentDraft.loadError ? [currentDraft.loadError] : []),
          ...formatDecisionDraftErrors({
            errors: validateDecisionDraft({ draft: prompt, templateFormat }),
            draft: prompt,
          }),
        ],
      };
    };
    const applyOperations: DecisionEvaluatorDraftHost["applyOperations"] = (
      operations
    ) => {
      const { draft: currentDraft } = latestRef.current;
      if (currentDraft.isLoading || !currentDraft.isVersionReady) {
        return {
          ok: false,
          error:
            "The decision version is still loading; read the draft again shortly.",
        };
      }
      const state = store.getState();
      const prompt = readPrompt();
      const result = applyDecisionDraftOperations({
        name: state.evaluator.globalName,
        prompt,
        scoringPolicy: readPolicy(),
        inputMapping: state.evaluator.inputMapping,
        templateFormat: playgroundStore.getState().templateFormat,
        operations,
      });
      if (!result.ok) {
        return result;
      }
      if (result.name !== state.evaluator.globalName) {
        state.setEvaluatorGlobalName(result.name);
        state.setEvaluatorName(result.name);
      }
      if (result.prompt !== prompt) {
        playgroundStore.getState().updateDecisionPrompt({
          instanceId: DECISION_EVALUATOR_DRAFT_INSTANCE_ID,
          request: result.prompt,
        });
      }
      if (
        operations.some(({ type }) => type === "set_scoring_policy") &&
        result.scoringPolicy
      ) {
        pending = {
          policy: result.scoringPolicy,
          replaced: currentDraft.policy,
        };
        currentDraft.setPolicy(result.scoringPolicy);
      }
      if (
        JSON.stringify(result.inputMapping.pathMapping) !==
        JSON.stringify(state.evaluator.inputMapping.pathMapping)
      ) {
        state.setPathMapping(result.inputMapping.pathMapping);
      }
      if (
        JSON.stringify(result.inputMapping.literalMapping) !==
        JSON.stringify(state.evaluator.inputMapping.literalMapping)
      ) {
        state.setLiteralMapping(result.inputMapping.literalMapping);
      }
      return { ok: true, output: buildSnapshot() };
    };
    let host: DecisionEvaluatorDraftHost | null = {
      getSnapshot: buildSnapshot,
      applyOperations,
      submit: createEvaluatorHostSubmit({
        getHandleSubmit: () => latestRef.current.submit,
        unmountedError:
          "The project decision-evaluator form is not mounted; cannot submit.",
      }),
    };
    const getDraftHost = () => host;
    const shouldAutoAccept = () =>
      agentStore.getState().permissions.edits === "bypass";
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readDecisionEvaluatorDraftOperation,
          handler: createReadDecisionEvaluatorDraftClientAction({
            getDraftHost,
          }),
        },
        {
          descriptor: editDecisionEvaluatorDraftOperation,
          handler: createEditDecisionEvaluatorDraftClientAction({
            getDraftHost,
            shouldAutoAccept,
          }),
        },
        {
          descriptor: submitDecisionEvaluatorDraftOperation,
          handler: createSubmitDecisionEvaluatorDraftClientAction({
            getDraftHost,
            shouldAutoAccept,
          }),
        },
      ],
    });
    return () => {
      host = null;
      unregister();
    };
  }, [agentStore, store, playgroundStore, mode, evaluatorNodeId]);
}
