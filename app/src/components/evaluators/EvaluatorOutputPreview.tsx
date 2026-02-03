import { useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Card,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Popover,
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import { type Annotation } from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { JSONBlock } from "@phoenix/components/code";
import type {
  EvaluatorOutputPreviewMutation,
  InlineLLMEvaluatorInput,
} from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EvaluationPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

export const EvaluatorOutputPreview = () => {
  const [error, setError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    EvaluationPreviewResult[]
  >([]);
  const evaluatorStore = useEvaluatorStoreInstance();
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  const playgroundStore = usePlaygroundStore();
  const credentials = useCredentialsContext((state) => state);
  const [previewEvaluator, isLoadingEvaluatorPreview] =
    useMutation<EvaluatorOutputPreviewMutation>(graphql`
      mutation EvaluatorOutputPreviewMutation($input: EvaluatorPreviewsInput!) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            annotation {
              explanation
              label
              score
              name
              id
            }
            error
          }
        }
      }
    `);
  const onTestEvaluator = () => {
    setError(null);
    setPreviewResults([]);
    const { instances } = playgroundStore.getState();
    const instanceId = instances[0].id;
    invariant(instanceId != null, "instanceId is required");
    const state = evaluatorStore.getState();

    let params:
      | { inlineLlmEvaluator: InlineLLMEvaluatorInput }
      | { builtInEvaluatorId: string };
    if (state.evaluator.isBuiltin) {
      invariant(state.evaluator.id, "evaluator id is required");
      params = {
        builtInEvaluatorId: state.evaluator.id,
      };
    } else {
      const outputConfig = state.outputConfig;
      invariant(outputConfig, "outputConfig is required");
      invariant(
        "values" in outputConfig,
        "outputConfig must have values, aka is a categorical annotation config"
      );
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        description: state.evaluator.description,
        name: state.evaluator.name || state.evaluator.globalName,
        includeExplanation: state.evaluator.includeExplanation,
        inputMapping: state.evaluator.inputMapping,
        outputConfig,
        instanceId,
        datasetId: state.dataset?.id ?? "",
      });
      params = {
        inlineLlmEvaluator: {
          description: payload.description,
          outputConfig: payload.outputConfig,
          promptVersion: payload.promptVersion,
        },
      };
    }

    previewEvaluator({
      variables: {
        input: {
          previews: [
            {
              context: state.evaluatorMappingSource,
              evaluator: params,
              inputMapping: state.evaluator.inputMapping,
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted(response, errors) {
        if (errors) {
          const errorMessages = getErrorMessagesFromRelayMutationError(errors);
          const errorMessage =
            errorMessages?.join("\n") ??
            errors[0]?.message ??
            "An unknown error occurred";
          setError(errorMessage);
        } else {
          const results: EvaluationPreviewResult[] =
            response.evaluatorPreviews.results.map((result) => {
              if (result.error != null) {
                return {
                  kind: "error" as const,
                  evaluatorName: result.evaluatorName,
                  message: result.error,
                };
              } else if (result.annotation != null) {
                return {
                  kind: "success" as const,
                  annotation: {
                    id: result.annotation.id,
                    name: result.annotation.name,
                    label: result.annotation.label,
                    score: result.annotation.score,
                    explanation: result.annotation.explanation,
                  },
                };
              } else {
                throw new Error(
                  "Unknown error: no annotation or error returned"
                );
              }
            });
          setPreviewResults(results);
        }
      },
      onError(error) {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        const errorMessage =
          errorMessages?.join("\n") ??
          error.message ??
          "An unknown error occurred";
        setError(errorMessage);
      },
    });
  };
  const isShowingPreview =
    isLoadingEvaluatorPreview || previewResults.length > 0 || error != null;
  const helpTextByEvaluatorKind = {
    LLM: "Test your evaluator with sample data. The input and reference fields are populated from your dataset example. The output field is a sample of what your task would produce - edit it to match your actual output format. Use these fields to map variables in your evaluator prompt.",
    CODE: "Test your evaluator with sample data. The input and reference fields are populated from your dataset example. The output field is a sample of what your task would produce - edit it to match your actual output format. Use these fields to map values to your evaluator function arguments.",
  };
  const helpText =
    helpTextByEvaluatorKind[evaluatorKind] ?? helpTextByEvaluatorKind.LLM;
  return (
    <>
      {isShowingPreview && (
        <Flex direction="column" gap="size-100">
          <Flex
            direction="column"
            gap="size-100"
            width="100%"
            marginBottom="size-100"
          >
            {isLoadingEvaluatorPreview && (
              <Card title="Evaluator Annotation Preview">
                <View padding="size-100">
                  <Flex direction="column" gap="size-100">
                    <Skeleton height={144} borderRadius={8} animation="wave" />
                    <Skeleton height={44} width="80%" animation="wave" />
                  </Flex>
                </View>
              </Card>
            )}
            {previewResults.map((result, i) => (
              <Flex direction="column" gap="size-100" key={i} width="100%">
                {result.kind === "success" ? (
                  <Card
                    title="Evaluator Annotation Preview"
                    width="100%"
                    extra={
                      <IconButton
                        size="S"
                        onPress={() => setPreviewResults([])}
                      >
                        <Icon svg={<Icons.CloseOutline />} />
                      </IconButton>
                    }
                  >
                    <AnnotationPreviewJSONBlock
                      annotation={result.annotation}
                    />
                    <View padding="size-100">
                      <DialogTrigger>
                        <ExperimentAnnotationButton
                          annotation={result.annotation}
                        />
                        <Popover>
                          <View padding="size-200">
                            <AnnotationDetailsContent
                              annotation={result.annotation}
                            />
                          </View>
                        </Popover>
                      </DialogTrigger>
                    </View>
                  </Card>
                ) : (
                  <Alert
                    variant="danger"
                    title={`Evaluator Error: ${result.evaluatorName}`}
                  >
                    {result.message}
                  </Alert>
                )}
              </Flex>
            ))}
          </Flex>

          {error && (
            <Alert
              variant="danger"
              title="Error"
              dismissable
              onDismissClick={() => setError(null)}
            >
              {error}
            </Alert>
          )}
        </Flex>
      )}
      <Flex direction="column" gap="size-100">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading weight="heavy" level={2}>
            Test with an Example
          </Heading>
          <Button
            size="S"
            onPress={onTestEvaluator}
            isPending={isLoadingEvaluatorPreview}
            variant="primary"
            leadingVisual={
              <Icon
                svg={
                  isLoadingEvaluatorPreview ? (
                    <Icons.LoadingOutline />
                  ) : (
                    <Icons.PlayCircleOutline />
                  )
                }
              />
            }
          >
            {isLoadingEvaluatorPreview ? "Testing..." : "Test"}
          </Button>
        </Flex>
        <Text color="text-500">{helpText}</Text>
      </Flex>
    </>
  );
};

function AnnotationPreviewJSONBlock(props: { annotation: Annotation }) {
  const { name, label, score, explanation } = props.annotation;
  const jsonString = useMemo(() => {
    return JSON.stringify({ name, label, score, explanation }, null, 2);
  }, [explanation, label, name, score]);

  return (
    <JSONBlock
      value={jsonString}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  );
}
