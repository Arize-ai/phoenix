import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorPreviewRunnerFactory } from "@phoenix/agent/tools/evaluatorDraftPreview";
import {
  createTestLlmEvaluatorDraftClientAction,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
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
import type { Annotation } from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { getPositiveOptimization } from "@phoenix/components/annotation/optimizationUtils";
import { JSONBlock } from "@phoenix/components/code";
import type {
  EvaluatorOutputPreviewMutation,
  InlineLLMEvaluatorInput,
} from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  EvaluatorInputMapping,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EvaluationPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

type EvaluatorPreviewsOutput =
  EvaluatorOutputPreviewMutation["response"]["evaluatorPreviews"];

/**
 * Computes whether an annotation score represents a positive optimization result
 * by matching the annotation name to the corresponding output config.
 */
function computePositiveOptimization({
  annotationName,
  score,
  evaluatorName,
  outputConfigs,
}: {
  annotationName: string;
  score: number | null | undefined;
  evaluatorName: string;
  outputConfigs: AnnotationConfig[];
}): boolean | null {
  if (outputConfigs.length === 0) {
    return null;
  }

  let matchedConfig: AnnotationConfig | undefined;
  if (outputConfigs.length === 1) {
    matchedConfig = outputConfigs[0];
  } else {
    // Multi-output: annotation name is "evaluatorName.configName"
    const prefix = evaluatorName + ".";
    if (annotationName.startsWith(prefix)) {
      const configName = annotationName.slice(prefix.length);
      matchedConfig = outputConfigs.find((c) => c.name === configName);
    }
  }

  if (matchedConfig == null) {
    return null;
  }

  const optimizationDirection =
    matchedConfig.optimizationDirection === "MAXIMIZE" ||
    matchedConfig.optimizationDirection === "MINIMIZE"
      ? matchedConfig.optimizationDirection
      : undefined;

  let lowerBound: number | undefined;
  let upperBound: number | undefined;
  let threshold: number | undefined;

  if ("values" in matchedConfig) {
    const scores = matchedConfig.values
      .map((v) => v.score)
      .filter((s): s is number => s != null);
    if (scores.length > 0) {
      lowerBound = Math.min(...scores);
      upperBound = Math.max(...scores);
    }
  } else if ("threshold" in matchedConfig) {
    threshold = matchedConfig.threshold ?? undefined;
    lowerBound = matchedConfig.lowerBound ?? undefined;
    upperBound = matchedConfig.upperBound ?? undefined;
  } else if ("lowerBound" in matchedConfig) {
    lowerBound = matchedConfig.lowerBound ?? undefined;
    upperBound = matchedConfig.upperBound ?? undefined;
  }

  return getPositiveOptimization({
    score,
    lowerBound,
    upperBound,
    threshold,
    optimizationDirection,
  });
}

export const EvaluatorOutputPreview = () => {
  const [error, setError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    EvaluationPreviewResult[]
  >([]);
  const evaluatorStore = useEvaluatorStoreInstance();
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const evaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName
  );
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
  const runEvaluatorPreview = useCallback(
    async ({
      params,
      inputMapping,
      testPayload,
      shouldUpdateUi,
    }: {
      params:
        | { inlineLlmEvaluator: InlineLLMEvaluatorInput }
        | { builtInEvaluatorId: string };
      inputMapping: EvaluatorInputMapping;
      testPayload: EvaluatorMappingSource;
      shouldUpdateUi: boolean;
    }): Promise<
      | { ok: true; output: EvaluatorPreviewsOutput }
      | { ok: false; error: string }
    > => {
      if (shouldUpdateUi) {
        // Match pre-batch behavior: a UI-visible preview run replaces any
        // stale error/results from the previous run before starting.
        setError(null);
        setPreviewResults([]);
      }
      return new Promise((resolve) => {
        previewEvaluator({
          variables: {
            input: {
              previews: [
                {
                  context: testPayload,
                  evaluator: params,
                  inputMapping,
                },
              ],
              credentials: toGqlCredentials(credentials),
            },
          },
          onCompleted(response, errors) {
            if (errors) {
              const errorMessages =
                getErrorMessagesFromRelayMutationError(errors);
              const errorMessage =
                errorMessages?.join("\n") ??
                errors[0]?.message ??
                "An unknown error occurred";
              if (shouldUpdateUi) {
                setError(errorMessage);
              }
              resolve({ ok: false, error: errorMessage });
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
              if (shouldUpdateUi) {
                setPreviewResults(results);
              }
              resolve({ ok: true, output: response.evaluatorPreviews });
            }
          },
          onError(error) {
            const errorMessages = getErrorMessagesFromRelayMutationError(error);
            const errorMessage =
              errorMessages?.join("\n") ??
              error.message ??
              "An unknown error occurred";
            if (shouldUpdateUi) {
              setError(errorMessage);
            }
            resolve({ ok: false, error: errorMessage });
          },
        });
      });
    },
    [credentials, previewEvaluator]
  );

  const buildPreviewRunner = ({
    shouldUpdateUi,
  }: {
    shouldUpdateUi: boolean;
  }) => {
    try {
      const { instances } = playgroundStore.getState();
      const instanceId = instances[0]?.id;
      invariant(instanceId != null, "instanceId is required");
      const state = evaluatorStore.getState();
      const inputMapping = state.evaluator.inputMapping;
      const formTestPayload = state.evaluatorMappingSource;
      let params:
        | { inlineLlmEvaluator: InlineLLMEvaluatorInput }
        | { builtInEvaluatorId: string };
      if (state.evaluator.isBuiltin) {
        invariant(state.evaluator.id, "evaluator id is required");
        params = { builtInEvaluatorId: state.evaluator.id };
      } else {
        invariant(
          state.outputConfigs.length > 0,
          "at least one output config is required"
        );
        const payload = createLLMEvaluatorPayload({
          playgroundStore,
          description: state.evaluator.description,
          name: state.evaluator.name || state.evaluator.globalName,
          includeExplanation: state.evaluator.includeExplanation,
          inputMapping,
          outputConfigs: state.outputConfigs,
          instanceId,
          datasetId: state.dataset?.id ?? "",
        });
        params = {
          inlineLlmEvaluator: {
            name: payload.name,
            description: payload.description,
            outputConfigs: payload.outputConfigs,
            promptVersion: payload.promptVersion,
          },
        };
      }
      return {
        ok: true as const,
        output: (testPayload = formTestPayload) =>
          runEvaluatorPreview({
            params,
            inputMapping,
            testPayload,
            shouldUpdateUi,
          }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
  const createPreviewRunner: EvaluatorPreviewRunnerFactory = ({
    shouldUpdateUi = false,
  } = {}) => buildPreviewRunner({ shouldUpdateUi });
  const createPreviewRunnerRef = useRef(createPreviewRunner);
  createPreviewRunnerRef.current = createPreviewRunner;

  const agentStore = useAgentStore();
  const isLlmEvaluator = evaluatorKind === "LLM";
  useEffect(() => {
    if (!isLlmEvaluator) {
      return;
    }
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(
      TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
      createTestLlmEvaluatorDraftClientAction({
        isDraftMounted: () => true,
        createPreviewRunner: (options) =>
          createPreviewRunnerRef.current(options),
      })
    );
    return () => {
      unregisterClientAction(TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME);
    };
  }, [agentStore, isLlmEvaluator]);

  const onTestEvaluator = () => {
    setError(null);
    setPreviewResults([]);
    const runner = buildPreviewRunner({ shouldUpdateUi: true });
    if (!runner.ok) {
      setError(runner.error);
      return;
    }
    void runner.output();
  };
  const isShowingPreview =
    isLoadingEvaluatorPreview || previewResults.length > 0 || error != null;
  const helpTextByEvaluatorKind: Record<string, string> = {
    LLM: "Test your evaluator using an example from your dataset. Use the selected example to map variables in the evaluator prompt to the inputs, outputs, and reference outputs of your dataset and task output.",
    CODE: "Test your evaluator using an example from your dataset. Use the selected example to map values of the evaluator function arguments to the inputs, outputs, and reference outputs of your dataset and task output.",
  };
  const helpText =
    helpTextByEvaluatorKind[evaluatorKind] ?? helpTextByEvaluatorKind.CODE;
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
                        <Icon svg={<Icons.Close />} />
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
                          positiveOptimization={
                            computePositiveOptimization({
                              annotationName: result.annotation.name,
                              score: result.annotation.score,
                              evaluatorName,
                              outputConfigs,
                            }) ?? undefined
                          }
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
                    <Icons.Loading />
                  ) : (
                    <Icons.PlayCircle />
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
