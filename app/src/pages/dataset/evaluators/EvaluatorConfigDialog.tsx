import { Suspense, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  Link,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { EvaluatorConfigDialog_dataset$key } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_dataset.graphql";
import {
  EvaluatorConfigDialog_evaluatorQuery,
  EvaluatorConfigDialog_evaluatorQuery$data,
} from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_evaluatorQuery.graphql";
import { EvaluatorConfigDialogAssignEvaluatorToDatasetMutation } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialogAssignEvaluatorToDatasetMutation.graphql";
import { promptVersionToInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { extractVariablesFromInstance } from "@phoenix/pages/playground/playgroundUtils";
import { jsonSchemaZodSchema } from "@phoenix/schemas";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type OutputConfig = NonNullable<
  EvaluatorConfigDialog_evaluatorQuery$data["evaluator"]["outputConfig"]
>;

// TODO: move to components
export function EvaluatorConfigDialog({
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
          <EvaluatorConfigDialogContent
            evaluatorId={evaluatorId}
            onClose={onClose}
            onEvaluatorAssigned={onEvaluatorAssigned}
            datasetRef={datasetRef}
          />
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
  const {
    control: inputMappingControl,
    getValues: getInputMappingValues,
    formState: { isValid: isInputMappingValid },
  } = useForm<EvaluatorFormValues>({
    defaultValues: {
      inputMapping: {},
    },
  });

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
          }
          ... on BuiltInEvaluator {
            inputSchema
          }
          ... on CodeEvaluator {
            inputSchema
          }
          ... on LLMEvaluator {
            outputConfig {
              name
              values {
                label
                score
              }
            }
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

  /**
   * The source of variables that need to be input mapped will change based on the evaluator kind.
   * Kind:
   * - LLM: The prompt variables
   * - CODE: evaluator.inputSchema json schema arguments
   *
   * @todo: implement this
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
    const inputConfig = getInputMappingValues().inputMapping;
    assignEvaluatorToDataset({
      variables: {
        input: {
          datasetId: dataset.id,
          evaluatorId: evaluator.id,
          inputConfig: { pathMapping: inputConfig },
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
    <>
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
      <View paddingX="size-300" paddingBottom="size-300" paddingTop="size-200">
        <Flex direction="row" alignItems="start" gap="size-200">
          {evaluator.kind === "LLM" && (
            <Flex
              direction="column"
              gap="size-300"
              flex="1"
              css={css`
                overflow: hidden;
              `}
            >
              {evaluator.promptVersion && (
                <Flex direction="column" gap="size-100">
                  <Text>
                    This is in read only mode, you can{" "}
                    <Link to="TODO: link to evaluator edit page when it exists">
                      edit the global evaluator
                    </Link>
                  </Text>
                  <Text size="L">Prompt</Text>
                  <PromptChatMessages promptVersion={evaluator.promptVersion} />
                </Flex>
              )}
              {evaluator.outputConfig && (
                <Flex direction="column" gap="size-100">
                  <Text size="L">Eval</Text>
                  <Flex
                    direction="row"
                    alignItems="center"
                    gap="size-100"
                    css={css`
                      color: var(--ac-global-color-grey-600);
                    `}
                  >
                    <AnnotationNameAndValue
                      annotation={{ name: evaluator.outputConfig.name }}
                      displayPreference="none"
                      size="XS"
                      maxWidth="100%"
                    />
                  </Flex>
                  <Text color="grey-700">
                    {getOutputConfigValuesSummary(evaluator.outputConfig)}
                  </Text>
                </Flex>
              )}
            </Flex>
          )}
          <Flex direction="column" gap="size-300" flex="1">
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
            <EvaluatorInputMapping
              control={inputMappingControl}
              variables={inputVariables}
              evaluatorInput={evaluatorInput}
            />
          </Flex>
        </Flex>
      </View>
    </>
  );
}

function getOutputConfigValuesSummary(outputConfig: OutputConfig) {
  return outputConfig.values
    .map(
      (value) =>
        value.label + (value.score != null ? " (" + value.score + ")" : "")
    )
    .join(", ");
}
