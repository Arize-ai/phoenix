import { Suspense, useCallback, useMemo, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation } from "react-relay";
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
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { CreateLLMProjectEvaluatorSlideover_createProjectLlmEvaluatorMutation } from "@phoenix/pages/project/evaluators/__generated__/CreateLLMProjectEvaluatorSlideover_createProjectLlmEvaluatorMutation.graphql";
import { createProjectLLMEvaluatorPayload } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";
import { ProjectEvaluatorTargetField } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetField";
import { ProjectEvaluatorTestPlaceholder } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPlaceholder";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const CreateLLMProjectEvaluatorSlideover = ({
  projectId,
  updateConnectionIds,
  ...props
}: {
  projectId: string;
  updateConnectionIds?: string[];
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
                  updateConnectionIds={updateConnectionIds}
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
  updateConnectionIds,
}: {
  onClose: () => void;
  projectId: string;
  updateConnectionIds?: string[];
}) => {
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const [targetType, setTargetType] = useState<ProjectEvaluatorTarget>("span");
  const [createProjectLlmEvaluator, isCreating] =
    useMutation<CreateLLMProjectEvaluatorSlideover_createProjectLlmEvaluatorMutation>(
      graphql`
        mutation CreateLLMProjectEvaluatorSlideover_createProjectLlmEvaluatorMutation(
          $input: CreateProjectLLMEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createProjectLlmEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "ProjectEvaluatorEdge"
              ) {
              id
              name
              ...ProjectEvaluatorsTable_row
            }
          }
        }
      `
    );

  const defaultOutputConfig =
    DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs[0];
  const defaultEvaluatorName =
    DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName;
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
        // Keep the output config name in sync with the evaluator name, as the
        // dataset create dialog does
        outputConfigs: [{ ...defaultOutputConfig, name: defaultEvaluatorName }],
      }) satisfies EvaluatorStoreProps,
    [defaultEvaluatorName, defaultOutputConfig]
  );

  const onSubmit = useCallback(
    (store: EvaluatorStoreInstance): Promise<EvaluatorSubmitResult> => {
      setError(undefined);
      const {
        evaluator: {
          globalName,
          description,
          inputMapping,
          includeExplanation,
        },
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
        return Promise.resolve({ ok: false, error: message });
      }

      const input = createProjectLLMEvaluatorPayload({
        playgroundStore,
        instanceId,
        projectId,
        targetType,
        name: globalName,
        description,
        outputConfigs,
        inputMapping,
        includeExplanation,
      });
      return new Promise<EvaluatorSubmitResult>((resolve) => {
        createProjectLlmEvaluator({
          variables: {
            input,
            connectionIds: updateConnectionIds ?? [],
          },
          onCompleted: (response) => {
            const createdEvaluator =
              response.createProjectLlmEvaluator.evaluator;
            onClose();
            notifySuccess({ title: "Evaluator created" });
            resolve({
              ok: true,
              acceptedBy: "user",
              evaluator: {
                id: createdEvaluator.id,
                name: createdEvaluator.name,
              },
            });
          },
          onError: (mutationError) => {
            const message =
              getErrorMessagesFromRelayMutationError(mutationError)?.join(
                "\n"
              ) ?? mutationError.message;
            setError(message);
            resolve({ ok: false, error: message });
          },
        });
      });
    },
    [
      createProjectLlmEvaluator,
      instanceId,
      notifySuccess,
      onClose,
      playgroundStore,
      projectId,
      targetType,
      updateConnectionIds,
    ]
  );

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => (
        <EditLLMEvaluatorDialogContent
          onClose={onClose}
          onSubmit={() => onSubmit(store)}
          isSubmitting={isCreating}
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
