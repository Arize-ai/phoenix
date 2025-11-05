import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

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
  Text,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { EvaluatorConfigDialog_dataset$key } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_dataset.graphql";
import {
  EvaluatorConfigDialog_evaluatorQuery,
  EvaluatorConfigDialog_evaluatorQuery$data,
} from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_evaluatorQuery.graphql";
import { EvaluatorConfigDialogAssignEvaluatorToDatasetMutation } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialogAssignEvaluatorToDatasetMutation.graphql";
import { datasetEvaluatorsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import {
  EvaluatorInputMapping,
  InputMapping,
} from "@phoenix/pages/evaluators/EvaluatorInputMapping";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { extractVariablesFromInstance } from "@phoenix/pages/playground/playgroundUtils";

type OutputConfig = NonNullable<
  EvaluatorConfigDialog_evaluatorQuery$data["evaluator"]["outputConfig"]
>;

export function EvaluatorConfigDialog({
  evaluatorId,
  onClose,
  datasetRef,
}: {
  evaluatorId: string;
  onClose: () => void;
  datasetRef: EvaluatorConfigDialog_dataset$key;
}) {
  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");

  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );
  const {
    control: inputMappingControl,
    getValues: getInputMappingValues,
    formState: { isValid: isInputMappingValid },
  } = useForm<InputMapping>({
    defaultValues: {},
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
              ...PromptChatMessagesCard__main
            }
          }
        }
      }
    `,
    { evaluatorId }
  );

  const [assignEvaluatorToDataset, isAssigningEvaluatorToDataset] =
    useMutation<EvaluatorConfigDialogAssignEvaluatorToDatasetMutation>(graphql`
      mutation EvaluatorConfigDialogAssignEvaluatorToDatasetMutation(
        $input: AssignEvaluatorToDatasetInput!
        $datasetId: ID!
      ) {
        assignEvaluatorToDataset(input: $input) {
          query {
            ...DatasetEvaluatorsPage_evaluators
              @arguments(datasetId: $datasetId)
          }
          evaluator {
            id
          }
        }
      }
    `);

  const [promptVariables, setPromptVariables] = useState<string[]>([]);

  const updatePromptVariables = useCallback(async () => {
    if (!evaluator.prompt || !evaluator.promptVersion) {
      return;
    }
    const response = await fetchPlaygroundPromptAsInstance({
      promptId: evaluator.prompt.id,
      promptVersionId: evaluator.promptVersion.id,
    });
    if (!response) {
      return;
    }
    const promptVariables = extractVariablesFromInstance({
      instance: { id: 0, ...response.instance },
      templateFormat: evaluator.promptVersion.templateFormat,
    });
    setPromptVariables(promptVariables);
  }, [evaluator]);

  useEffect(() => {
    updatePromptVariables();
  }, [updatePromptVariables]);

  const onAddEvaluator = () => {
    if (!isInputMappingValid) {
      return;
    }
    // TODO: save input mapping
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const inputMapping = getInputMappingValues();
    assignEvaluatorToDataset({
      variables: {
        input: {
          datasetId: dataset.id,
          evaluatorId: evaluator.id,
        },
        datasetId: dataset.id,
      },
    });
    onClose();
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Flex direction="row" alignItems="center" gap="size-50">
              Add
              <Flex direction="row" alignItems="center" gap="size-25">
                <Icon svg={<Icons.Scale />} />
                {evaluator.name}
              </Flex>
              to
              <Flex direction="row" alignItems="center" gap="size-25">
                <Icon svg={<Icons.DatabaseOutline />} />
                {dataset.name}
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
        <View
          paddingX="size-300"
          paddingBottom="size-300"
          paddingTop="size-200"
        >
          <Flex direction="row" alignItems="start" gap="size-200">
            {evaluator.kind === "LLM" && (
              <Flex direction="column" gap="size-300" flex="1">
                {evaluator.promptVersion && (
                  <Flex direction="column" gap="size-100">
                    <Text>
                      This is in read only mode, you can{" "}
                      <Link to="TODO: link to evaluator edit page when it exists">
                        edit the global evaluator
                      </Link>
                    </Text>
                    <Text size="L">Prompt</Text>
                    <PromptChatMessages
                      promptVersion={evaluator.promptVersion}
                    />
                  </Flex>
                )}
                {evaluator.outputConfig && (
                  <Flex direction="column" gap="size-100">
                    <Text size="L">Eval</Text>
                    <Flex direction="row" alignItems="center" gap="size-100">
                      <AnnotationColorSwatch
                        annotationName={evaluator.outputConfig.name}
                      />
                      <Text color="grey-600" weight="heavy">
                        {evaluator.outputConfig.name}
                      </Text>
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
                  datasetSelectIsDisabled
                  onSelectDataset={() => {}}
                  selectedSplitIds={[]}
                  onSelectSplits={() => {}}
                  onSelectExampleId={setSelectedExampleId}
                />
              </Flex>
              <EvaluatorInputMapping
                exampleId={selectedExampleId ?? undefined}
                control={inputMappingControl}
                variables={promptVariables}
              />
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
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
