import { Suspense, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay/Modal";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { getOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { createProjectLlmEvaluator } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";
import { ProjectEvaluatorTargetField } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetField";
import { ProjectEvaluatorTestPlaceholder } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPlaceholder";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

export const CreateLLMProjectEvaluatorSlideover = ({
  projectId,
  ...props
}: {
  projectId: string;
} & ModalOverlayProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              <EvaluatorPlaygroundProvider>
                <CreateProjectEvaluatorDialog
                  onClose={close}
                  projectId={projectId}
                />
              </EvaluatorPlaygroundProvider>
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const CreateProjectEvaluatorDialog = ({
  onClose,
  projectId,
}: {
  onClose: () => void;
  projectId: string;
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetType, setTargetType] = useState<ProjectEvaluatorTarget>("span");

  const defaultOutputConfig =
    DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs[0];
  const defaultEvaluatorName =
    DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName;
  const initialState = {
    ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
    // Keep the output config name in sync with the evaluator name, as the
    // dataset create dialog does
    outputConfigs: [{ ...defaultOutputConfig, name: defaultEvaluatorName }],
  } satisfies EvaluatorStoreProps;

  const onSubmit = async (
    store: EvaluatorStoreInstance
  ): Promise<EvaluatorSubmitResult> => {
    const {
      evaluator: { globalName },
      outputConfigs,
    } = store.getState();
    invariant(
      outputConfigs && outputConfigs.length > 0,
      "At least one output config is required"
    );

    const validationErrors = getOutputConfigValidationErrors(outputConfigs);
    if (validationErrors.length > 0) {
      const message = validationErrors.join("\n");
      setError(message);
      return { ok: false, error: message };
    }

    setIsSubmitting(true);
    try {
      const evaluator = await createProjectLlmEvaluator({
        projectId,
        targetType,
        name: globalName.trim(),
      });
      onClose();
      notifySuccess({
        title: "Evaluator created",
      });
      return {
        ok: true,
        acceptedBy: "user",
        evaluator,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create evaluator";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditLLMEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isSubmitting}
          mode="create"
          error={error}
          formLeftPanelExtra={
            <ProjectEvaluatorTargetField
              value={targetType}
              onChange={setTargetType}
            />
          }
          formRightPanel={<ProjectEvaluatorTestPlaceholder />}
        />
      )}
    </EvaluatorStoreProvider>
  );
};
