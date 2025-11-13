import {
  PropsWithChildren,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { DialogTrigger, DialogTriggerProps } from "react-aria-components";
import { useFormContext } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Alert } from "@phoenix/components/alert";
import { Button } from "@phoenix/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { EditEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_evaluatorQuery.graphql";
import { EditEvaluatorSlideover_updateLLMEvaluatorMutation } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import {
  EvaluatorForm,
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export const EditEvaluatorSlideover = ({
  children,
  evaluatorId,
  ...props
}: PropsWithChildren<
  { evaluatorId: string } & Omit<DialogTriggerProps, "children">
>) => {
  return (
    <DialogTrigger {...props}>
      {children}
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Dialog>
            {({ close }) => (
              <Suspense fallback={<Loading />}>
                {evaluatorId && (
                  <EditEvaluatorDialog
                    evaluatorId={evaluatorId}
                    onClose={close}
                  />
                )}
              </Suspense>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
};

const EditEvaluatorDialog = ({
  evaluatorId,
  onClose,
}: {
  evaluatorId: string;
  onClose: () => void;
}) => {
  const data = useLazyLoadQuery<EditEvaluatorSlideover_evaluatorQuery>(
    graphql`
      query EditEvaluatorSlideover_evaluatorQuery($evaluatorId: ID!) {
        evaluator: node(id: $evaluatorId) {
          ... on Evaluator {
            id
            name
            description
            kind
            ... on LLMEvaluator {
              prompt {
                id
                name
              }
              promptVersion {
                ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              }
              outputConfig {
                name
                values {
                  label
                  score
                }
              }
            }
          }
        }
      }
    `,
    { evaluatorId }
  );
  const evaluator = data.evaluator as Mutable<typeof data.evaluator>;
  invariant(evaluator, "evaluator is required");

  const defaultValues: EvaluatorFormValues = useMemo(() => {
    return {
      evaluator: {
        name: evaluator.name ?? "",
        description: evaluator.description ?? "",
      },
      choiceConfig: {
        name: evaluator.outputConfig?.name ?? "",
        choices:
          evaluator.outputConfig?.values.map((value) => ({
            label: value.label,
            score: value.score ?? undefined,
          })) ?? [],
      },
    };
  }, [evaluator]);
  const form = useEvaluatorForm(defaultValues);

  return (
    <EvaluatorFormProvider
      form={form}
      promptId={evaluator.prompt?.id}
      promptName={evaluator.prompt?.name}
      promptVersionRef={evaluator.promptVersion}
    >
      <EditEvaluatorDialogContent evaluatorId={evaluatorId} onClose={onClose} />
    </EvaluatorFormProvider>
  );
};

const EditEvaluatorDialogContent = ({
  evaluatorId,
  onClose,
}: {
  evaluatorId: string;
  onClose: () => void;
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const form = useFormContext<EvaluatorFormValues>();
  invariant(form, "form is required");
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId, "instanceId is required");
  const [updateLlmEvaluator, isUpdating] =
    useMutation<EditEvaluatorSlideover_updateLLMEvaluatorMutation>(graphql`
      mutation EditEvaluatorSlideover_updateLLMEvaluatorMutation(
        $input: UpdateLLMEvaluatorInput!
      ) {
        updateLlmEvaluator(input: $input) {
          evaluator {
            name
            ...EvaluatorsTable_row
          }
        }
      }
    `);
  const onSubmit = useCallback(() => {
    const {
      evaluator: { name, description },
      choiceConfig,
    } = form.getValues();
    const input = createLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      choiceConfig,
    });
    updateLlmEvaluator({
      variables: {
        input: {
          ...input,
          evaluatorId,
        },
      },
      onCompleted: (response) => {
        onClose();
        notifySuccess({
          title: "Evaluator updated",
          message: `Evaluator "${response.updateLlmEvaluator.evaluator.name}" updated successfully`,
        });
      },
      onError: (error) => {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        setError(errorMessages?.join("\n") ?? undefined);
      },
    });
  }, [
    form,
    playgroundStore,
    instanceId,
    updateLlmEvaluator,
    evaluatorId,
    onClose,
    notifySuccess,
  ]);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Evaluator</DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isUpdating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={isUpdating}
            isPending={isUpdating}
            onPress={onSubmit}
          >
            Update
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      <fieldset
        disabled={isUpdating}
        css={css`
          all: unset;
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-size-200);
          padding: var(--ac-global-dimension-size-200);
          overflow: auto;
        `}
      >
        {error && (
          <Alert variant="danger" title="Failed to update evaluator">
            {error}
          </Alert>
        )}
        <EvaluatorForm />
      </fieldset>
    </DialogContent>
  );
};
