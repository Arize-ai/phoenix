import { Suspense, useCallback, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Loading,
  Text,
  TextField,
} from "@phoenix/components";
import type { EvaluatorConfigDialog_dataset$key } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorConfigDialog_dataset.graphql";
import type { EvaluatorConfigDialog_evaluatorQuery } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorConfigDialog_evaluatorQuery.graphql";
import type { EvaluatorConfigDialogAssignEvaluatorToDatasetMutation } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorConfigDialogAssignEvaluatorToDatasetMutation.graphql";
import { EvaluatorCodeConfig } from "@phoenix/components/evaluators/EvaluatorConfigDialog/EvaluatorCodeConfig";
import { EvaluatorLLMConfig } from "@phoenix/components/evaluators/EvaluatorConfigDialog/EvaluatorLLMConfig";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { promptVersionToInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { extractVariablesFromInstance } from "@phoenix/pages/playground/playgroundUtils";
import { jsonSchemaZodSchema } from "@phoenix/schemas";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type EvaluatorConfigDialogForm = EvaluatorFormValues;

export function EvaluatorConfigDialog({
  evaluatorId,
  onClose,
  onEvaluatorAssigned,
  datasetRef,
}: {
  evaluatorId: string | null;
  onClose: () => void;
  onEvaluatorAssigned?: () => void;
  datasetRef: EvaluatorConfigDialog_dataset$key;
}) {
  return (
    <Dialog aria-label="Add evaluator to dataset">
      <DialogContent minHeight="300px">
        <Suspense
          fallback={
            <Flex flex={1} alignItems="center">
              <Loading />
            </Flex>
          }
        >
          {evaluatorId && (
            <EvaluatorConfigDialogContent
              evaluatorId={evaluatorId}
              onClose={onClose}
              onEvaluatorAssigned={onEvaluatorAssigned}
              datasetRef={datasetRef}
            />
          )}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function EvaluatorConfigDialogContent({
  evaluatorId,
  onClose,
  onEvaluatorAssigned,
  datasetRef,
}: {
  evaluatorId: string;
  onClose: () => void;
  onEvaluatorAssigned?: () => void;
  datasetRef: EvaluatorConfigDialog_dataset$key;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );

  const dataset = useFragment<EvaluatorConfigDialog_dataset$key>(
    graphql`
      fragment EvaluatorConfigDialog_dataset on Dataset {
        id
        name
      }
    `,
    datasetRef
  );

  const { evaluator } = useLazyLoadQuery<EvaluatorConfigDialog_evaluatorQuery>(
    graphql`
      query EvaluatorConfigDialog_evaluatorQuery($evaluatorId: ID!) {
        evaluator: node(id: $evaluatorId) {
          id
          ... on Evaluator {
            name
            kind
            isBuiltin
          }
          ... on BuiltInEvaluator {
            inputSchema
          }
          ... on CodeEvaluator {
            inputSchema
          }
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersion {
              id
              templateFormat
              ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              ...PromptChatMessagesCard__main
            }
          }
          ...EvaluatorLLMConfig_evaluator
          ...EvaluatorCodeConfig_evaluator
        }
      }
    `,
    { evaluatorId }
  );

  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    dataset.id,
    "DatasetEvaluatorsTable_evaluators"
  );
  const [assignEvaluatorToDataset, isAssigningEvaluatorToDataset] =
    useMutation<EvaluatorConfigDialogAssignEvaluatorToDatasetMutation>(graphql`
      mutation EvaluatorConfigDialogAssignEvaluatorToDatasetMutation(
        $input: AssignEvaluatorToDatasetInput!
        $datasetId: ID!
        $connectionIds: [ID!]!
      ) {
        assignEvaluatorToDataset(input: $input) {
          query {
            dataset: node(id: $datasetId) {
              ...PlaygroundDatasetSection_evaluators
                @arguments(datasetId: $datasetId)
              ...DatasetEvaluatorsTable_evaluators
                @arguments(datasetId: $datasetId)
            }
          }
          evaluator
            @appendNode(
              connections: $connectionIds
              edgeTypeName: "EvaluatorEdge"
            ) {
            ...EvaluatorsTable_row @arguments(datasetId: $datasetId)
          }
        }
      }
    `);

  const form = useForm<EvaluatorConfigDialogForm>({
    defaultValues: {
      inputMapping: {},
    },
  });
  const {
    control: inputMappingControl,
    getValues: getInputMappingValues,
    formState: { isValid: isInputMappingValid },
  } = form;

  /**
   * The source of variables that need to be input mapped will change based on the evaluator kind.
   * Kind:
   * - LLM: The prompt variables
   * - CODE: evaluator.inputSchema json schema arguments
   */
  const [inputVariables, setInputVariables] = useState<string[]>([]);

  const updateInputVariables = useCallback(async () => {
    setInputVariables([]);
    if (evaluator.kind === "LLM") {
      if (!evaluator.prompt || !evaluator.promptVersion) {
        return;
      }
      const instance = promptVersionToInstance({
        promptId: evaluator.prompt.id,
        promptName: evaluator.prompt.name,
        promptVersionRef: evaluator.promptVersion,
        promptVersionTag: null,
      });
      const promptVariables = extractVariablesFromInstance({
        instance: { id: 0, ...instance },
        templateFormat: evaluator.promptVersion.templateFormat,
      });
      setInputVariables(promptVariables);
    } else if (evaluator.kind === "CODE") {
      if (!evaluator.inputSchema) {
        return;
      }
      const inputSchema = jsonSchemaZodSchema.safeParse(evaluator.inputSchema);
      if (!inputSchema.success) {
        return;
      }
      if (!inputSchema.data.properties) {
        return;
      }
      const inputVariables = Object.keys(inputSchema.data.properties);
      setInputVariables(inputVariables);
    }
  }, [evaluator]);

  useEffect(() => {
    updateInputVariables();
  }, [updateInputVariables]);

  const [evaluatorInput, setEvaluatorInput] = useState<EvaluatorInput | null>(
    null
  );

  const onAddEvaluator = () => {
    if (!isInputMappingValid) {
      return;
    }
    const inputMapping = getInputMappingValues().inputMapping;
    assignEvaluatorToDataset({
      variables: {
        input: {
          datasetId: dataset.id,
          evaluatorId: evaluator.id,
          inputMapping,
        },
        connectionIds: [datasetEvaluatorsTableConnection],
        datasetId: dataset.id,
      },
      onCompleted: () => {
        onEvaluatorAssigned?.();
        notifySuccess({
          title: "Evaluator added",
          message: "The evaluator has been added to the dataset.",
        });
        onClose();
      },
      onError: (error) => {
        notifyError({
          title: "Failed to add evaluator",
          message:
            getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message,
        });
      },
    });
  };

  return (
    <FormProvider {...form}>
      <DialogHeader>
        <DialogTitle
          css={css`
            overflow: hidden;
          `}
        >
          <Flex
            direction="row"
            alignItems="center"
            gap="size-50"
            maxWidth="100%"
          >
            Add
            <Flex
              direction="row"
              alignItems="center"
              gap="size-25"
              minWidth={0}
            >
              <Icon svg={<Icons.Scale />} />
              <Truncate maxWidth="100%" title={evaluator.name}>
                {evaluator.name}
              </Truncate>
            </Flex>
            to
            <Flex
              direction="row"
              alignItems="center"
              gap="size-25"
              minWidth={0}
            >
              <Icon svg={<Icons.DatabaseOutline />} />
              <Truncate maxWidth="100%" title={dataset.name}>
                {dataset.name}
              </Truncate>
            </Flex>
          </Flex>
        </DialogTitle>
        <DialogTitleExtra>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onPress={onAddEvaluator}
            isDisabled={!isInputMappingValid || isAssigningEvaluatorToDataset}
          >
            Done
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      <div
        css={css`
          padding: var(--ac-global-dimension-static-size-200)
            var(--ac-global-dimension-static-size-300);
          overflow-y: auto;
          position: relative;
        `}
      >
        <Flex direction="row" alignItems="start" gap="size-200">
          <Flex direction="column" gap="size-300" flex="1">
            <TextField>
              <Label>Name</Label>
              <Input placeholder={`e.g. is_correct`} />
              <Text slot="description">
                The name of the annotation that will be produced by this
                evaluator.
              </Text>
            </TextField>
            {evaluator.kind === "LLM" && (
              <EvaluatorLLMConfig queryRef={evaluator} />
            )}
            {evaluator.kind === "CODE" && (
              <EvaluatorCodeConfig
                queryRef={evaluator}
                evaluatorInput={evaluatorInput}
              />
            )}
          </Flex>
          <Flex
            direction="column"
            gap="size-300"
            flex="1"
            css={css`
              flex: 1;
              position: sticky;
              top: 0;
            `}
          >
            <Flex direction="column" gap="size-100">
              <Text size="L">Example</Text>
              <EvaluatorExampleDataset
                selectedDatasetId={dataset.id}
                onSelectDataset={() => {}}
                selectedSplitIds={[]}
                onSelectSplits={() => {}}
                selectedExampleId={selectedExampleId}
                onSelectExampleId={setSelectedExampleId}
                datasetSelectIsDisabled
                onEvaluatorInputObjectChange={setEvaluatorInput}
              />
            </Flex>
            {/* only show input mapping for non-builtin evaluators */}
            {/* builtin evaluators have hand made forms for their input mapping */}
            {!evaluator.isBuiltin && (
              <EvaluatorInputMapping
                control={inputMappingControl}
                variables={inputVariables}
                evaluatorInput={evaluatorInput}
              />
            )}
          </Flex>
        </Flex>
      </div>
    </FormProvider>
  );
}
