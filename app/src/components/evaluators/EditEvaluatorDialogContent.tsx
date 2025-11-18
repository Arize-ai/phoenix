import { useCallback, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Alert } from "@phoenix/components/alert";
import { Button } from "@phoenix/components/button";
import { CreateLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { UpdateLLMEvaluatorInput } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import {
  EvaluatorForm,
  EvaluatorFormValues,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Embed this DialogContent component within a DatasetEvaluatorSlideover or an EvaluatorSlideover.
 * The mutation code is agnostic towards evaluator mutation, therefor this component can be used for both.
 */
export const EditEvaluatorDialogContent = ({
  evaluatorId,
  onClose,
  onSubmit,
  isSubmitting,
  mode,
}: {
  evaluatorId?: string;
  onClose: () => void;
  onSubmit: (args: {
    input: UpdateLLMEvaluatorInput | CreateLLMEvaluatorInput;
    onCompleted: ({ name }: { name: string }) => void;
    onError: (error: Error) => void;
  }) => void;
  isSubmitting: boolean;
  mode: "create" | "update";
}) => {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | undefined>(undefined);
  const form = useFormContext<EvaluatorFormValues>();
  invariant(form, "form is required");
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  invariant(instanceId != null, "instanceId is required");
  const handleSubmit = useCallback(() => {
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
    const title = mode === "create" ? "Evaluator created" : "Evaluator updated";

    onSubmit({
      input: evaluatorId
        ? {
            ...input,
            evaluatorId,
          }
        : input,
      onCompleted: () => {
        onClose();
        notifySuccess({
          title,
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
    onSubmit,
    evaluatorId,
    onClose,
    notifySuccess,
    mode,
  ]);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Evaluator" : "Edit Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={isSubmitting}
            isPending={isSubmitting}
            onPress={handleSubmit}
          >
            {mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      <fieldset
        disabled={isSubmitting}
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
          <Alert
            variant="danger"
            title={
              mode === "create"
                ? "Failed to create evaluator"
                : "Failed to update evaluator"
            }
          >
            {error}
          </Alert>
        )}
        <EvaluatorForm />
      </fieldset>
    </DialogContent>
  );
};
