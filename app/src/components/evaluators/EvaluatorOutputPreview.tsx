import { useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  ContentSkeleton,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Popover,
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
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";

export const EvaluatorOutputPreview = () => {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={3}>Test your evaluator</Heading>
      <Text color="text-500">
        Give your evaluator a test run against the selected dataset example, and
        the hypothetical task output.
      </Text>
      <EvaluatorOutputPreviewContent />
    </Flex>
  );
};

type EvaluationPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

const EvaluatorOutputPreviewContent = () => {
  const [error, setError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    EvaluationPreviewResult[]
  >([]);
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const [previewEvaluator, isLoadingEvaluatorPreview] =
    useMutation<EvaluatorOutputPreviewMutation>(graphql`
      mutation EvaluatorOutputPreviewMutation(
        $input: EvaluatorPreviewItemInput!
      ) {
        evaluatorPreviews(input: { previews: [$input] }) {
          results {
            __typename
            ... on EvaluationSuccess {
              annotation {
                explanation
                label
                score
                name
                id
              }
            }
            ... on EvaluationError {
              evaluatorName
              message
            }
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
    if (!state.evaluator.isBuiltin) {
      invariant(state.outputConfig, "outputConfig is required");
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        description: state.evaluator.description,
        name: state.evaluator.displayName || state.evaluator.name,
        includeExplanation: state.evaluator.includeExplanation,
        inputMapping: state.evaluator.inputMapping,
        outputConfig: state.outputConfig,
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
    } else {
      invariant(state.evaluator.id, "evaluator id is required");
      params = {
        builtInEvaluatorId: state.evaluator.id,
      };
    }

    previewEvaluator({
      variables: {
        input: {
          context: state.preMappedInput,
          evaluator: params,
          inputMapping: state.evaluator.inputMapping,
        },
      },
      onCompleted(response, errors) {
        if (errors) {
          setError(errors[0].message);
        } else {
          const results: EvaluationPreviewResult[] =
            response.evaluatorPreviews.results
              .filter(
                (
                  result
                ): result is Exclude<typeof result, { __typename: "%other" }> =>
                  result.__typename !== "%other"
              )
              .map((result) => {
                if (result.__typename === "EvaluationSuccess") {
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
                  return {
                    kind: "error" as const,
                    evaluatorName: result.evaluatorName,
                    message: result.message,
                  };
                }
              });
          setPreviewResults(results);
        }
      },
      onError(error) {
        setError(error.message);
      },
    });
  };
  return (
    <Flex direction="column" gap="size-100">
      <Flex
        direction="row"
        gap="size-100"
        width="100%"
        justifyContent="space-between"
      >
        <Button
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
      {isLoadingEvaluatorPreview ? (
        <ContentSkeleton />
      ) : (
        <Flex direction="column" gap="size-100">
          {previewResults.map((result, i) => (
            <Flex direction="column" gap="size-100" key={i}>
              {result.kind === "success" ? (
                <Card title="Annotation Preview">
                  <AnnotationPreviewJSONBlock annotation={result.annotation} />
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
                <Card title={`Evaluator Error: ${result.evaluatorName}`}>
                  <div
                    css={css`
                      padding: var(--ac-global-dimension-size-100);
                      background-color: var(--ac-global-color-danger-100);
                      border-radius: var(--ac-global-rounding-small);
                      white-space: pre-wrap;
                      overflow: auto;
                      max-height: 200px;
                    `}
                  >
                    <Text color="danger">{result.message}</Text>
                  </div>
                </Card>
              )}
            </Flex>
          ))}
        </Flex>
      )}

      {error && (
        <div
          css={css`
            padding: var(--ac-global-dimension-size-100);
            background-color: var(--ac-global-color-danger-100);
            border-radius: var(--ac-global-rounding-small);
            white-space: pre-wrap;
            overflow: auto;
            max-height: 200px;
          `}
        >
          <Text color="danger">{error}</Text>
        </div>
      )}
    </Flex>
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
