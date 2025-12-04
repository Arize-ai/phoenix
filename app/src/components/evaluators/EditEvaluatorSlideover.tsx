import { Suspense, useCallback, useMemo } from "react";
import { ModalOverlayProps } from "react-aria-components";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import { CreateLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { Dialog } from "@phoenix/components/dialog";
import { EditEvaluatorSlideover_evaluator$key } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_evaluator.graphql";
import { EditEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_evaluatorQuery.graphql";
import {
  EditEvaluatorSlideover_updateLLMEvaluatorMutation,
  UpdateLLMEvaluatorInput,
} from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { EditEvaluatorDialogContent } from "@phoenix/components/evaluators/EditEvaluatorDialogContent";
import {
  EvaluatorFormProvider,
  EvaluatorFormValues,
  useEvaluatorForm,
} from "@phoenix/components/evaluators/EvaluatorForm";
import { Loading } from "@phoenix/components/loading";
import { Modal, ModalOverlay } from "@phoenix/components/overlay/Modal";
import { Mutable } from "@phoenix/typeUtils";

export const EditEvaluatorSlideover = ({
  evaluatorId,
  updateConnectionIds,
  ...props
}: {
  evaluatorId: string;
  updateConnectionIds?: string[];
  subMenuTrigger?: boolean;
} & ModalOverlayProps) => {
  return (
    <ModalOverlay {...props}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {evaluatorId && (
                <EditEvaluatorDialog
                  evaluatorId={evaluatorId}
                  updateConnectionIds={updateConnectionIds}
                  onClose={close}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const EditEvaluatorDialog = ({
  evaluatorId,
  onClose,
  updateConnectionIds,
}: {
  evaluatorId: string;
  onClose: () => void;
  updateConnectionIds?: string[];
}) => {
  const query = useLazyLoadQuery<EditEvaluatorSlideover_evaluatorQuery>(
    graphql`
      query EditEvaluatorSlideover_evaluatorQuery($evaluatorId: ID!) {
        evaluator: node(id: $evaluatorId) {
          ... on Evaluator {
            ...EditEvaluatorSlideover_evaluator
          }
        }
      }
    `,
    { evaluatorId }
  );
  const evaluatorFragment = useFragment<EditEvaluatorSlideover_evaluator$key>(
    graphql`
      fragment EditEvaluatorSlideover_evaluator on Evaluator {
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
            optimizationDirection
            values {
              label
              score
            }
          }
        }
      }
    `,
    query.evaluator
  );
  const evaluator = evaluatorFragment as Mutable<typeof evaluatorFragment>;
  invariant(evaluator, "evaluator is required");
  const [updateLlmEvaluator, isUpdating] =
    useMutation<EditEvaluatorSlideover_updateLLMEvaluatorMutation>(graphql`
      mutation EditEvaluatorSlideover_updateLLMEvaluatorMutation(
        $input: UpdateDatasetLLMEvaluatorInput!
        $connectionIds: [ID!]!
      ) {
        updateDatasetLlmEvaluator(input: $input) {
          evaluator
            @appendNode(
              connections: $connectionIds
              edgeTypeName: "EvaluatorEdge"
            ) {
            id
            name
            ...EvaluatorsTable_row
            ...EditEvaluatorSlideover_evaluator
          }
        }
      }
    `);
  const onSubmit = useCallback(
    (args: {
      input: UpdateLLMEvaluatorInput | CreateLLMEvaluatorInput;
      onCompleted: ({ name }: { name: string }) => void;
      onError: (error: Error) => void;
    }) => {
      invariant(
        "evaluatorId" in args.input,
        "evaluatorId is required when updating an evaluator. "
      );
      updateLlmEvaluator({
        variables: {
          input: args.input,
          connectionIds: updateConnectionIds ?? [],
        },
        onCompleted: (response) => {
          args.onCompleted({
            name: response.updateLlmEvaluator.evaluator.name,
          });
        },
        onError: args.onError,
      });
    },
    [updateLlmEvaluator, updateConnectionIds]
  );
  const defaultValues: EvaluatorFormValues = useMemo(() => {
    return {
      evaluator: {
        name: evaluator.name ?? "",
        description: evaluator.description ?? "",
      },
      choiceConfig: {
        name: evaluator.outputConfig?.name ?? "",
        optimizationDirection:
          evaluator.outputConfig?.optimizationDirection ?? "MAXIMIZE",
        choices: evaluator.outputConfig?.values.map((value) => ({
          label: value.label,
          score: value.score ?? undefined,
        })) ?? [
          { label: "", score: undefined },
          { label: "", score: undefined },
        ],
      },
      inputMapping: {
        // TODO: populate input mapping from evaluator
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
      <EditEvaluatorDialogContent
        evaluatorId={evaluatorId}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isUpdating}
        mode="update"
      />
    </EvaluatorFormProvider>
  );
};
