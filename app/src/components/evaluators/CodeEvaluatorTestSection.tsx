import { useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";

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
import type { CodeEvaluatorTestSectionMutation } from "@phoenix/components/evaluators/__generated__/CodeEvaluatorTestSectionMutation.graphql";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { CodeEvaluatorLanguage } from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type EvaluationPreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

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

  if ("values" in matchedConfig) {
    // Categorical: compute bounds from values scores
    const scores = matchedConfig.values
      .map((v) => v.score)
      .filter((s): s is number => s != null);
    if (scores.length > 0) {
      lowerBound = Math.min(...scores);
      upperBound = Math.max(...scores);
    }
  } else {
    // Continuous: use bounds directly
    lowerBound = matchedConfig.lowerBound ?? undefined;
    upperBound = matchedConfig.upperBound ?? undefined;
  }

  return getPositiveOptimization({
    score,
    lowerBound,
    upperBound,
    optimizationDirection,
  });
}

/**
 * Encode a numeric ID to a Relay GlobalID string.
 */
function encodeGlobalId(typeName: string, id: number): string {
  return globalThis.btoa(`${typeName}:${id}`);
}

export type CodeEvaluatorTestSectionProps = {
  /** The evaluator's source code */
  sourceCode: string;
  /** The language (PYTHON or TYPESCRIPT) */
  language: CodeEvaluatorLanguage;
  /** The sandbox config ID (numeric) if selected */
  sandboxConfigId: number | null;
};

/**
 * Test section for code evaluators - allows testing the evaluator
 * against example data before saving.
 */
export const CodeEvaluatorTestSection = ({
  sourceCode,
  language,
  sandboxConfigId,
}: CodeEvaluatorTestSectionProps) => {
  const [error, setError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    EvaluationPreviewResult[]
  >([]);

  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const evaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName || "evaluator"
  );
  const evaluatorDescription = useEvaluatorStore(
    (state) => state.evaluator.description
  );
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );

  const [testEvaluator, isLoading] =
    useMutation<CodeEvaluatorTestSectionMutation>(graphql`
      mutation CodeEvaluatorTestSectionMutation($input: EvaluatorPreviewsInput!) {
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

    if (!sourceCode.trim()) {
      setError("Source code is required");
      return;
    }

    if (outputConfigs.length === 0) {
      setError("At least one output configuration is required");
      return;
    }

    if (sandboxConfigId == null) {
      setError("Please select a sandbox configuration to test the evaluator");
      return;
    }

    const gqlOutputConfigs = buildOutputConfigsInput(outputConfigs);
    const sandboxConfigGlobalId = encodeGlobalId(
      "SandboxConfig",
      sandboxConfigId
    );

    testEvaluator({
      variables: {
        input: {
          previews: [
            {
              context: evaluatorMappingSource,
              evaluator: {
                inlineCodeEvaluator: {
                  name: evaluatorName,
                  description: evaluatorDescription || null,
                  language,
                  sourceCode,
                  outputConfigs: gqlOutputConfigs,
                  sandboxConfigId: sandboxConfigGlobalId,
                },
              },
              inputMapping,
            },
          ],
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
    isLoading || previewResults.length > 0 || error != null;

  return (
    <Flex direction="column" gap="size-100">
      {/* Results section */}
      {isShowingPreview && (
        <Flex direction="column" gap="size-100" marginBottom="size-100">
          {isLoading && (
            <Card title="Evaluator Result">
              <View padding="size-100">
                <Flex direction="column" gap="size-100">
                  <Skeleton height={100} borderRadius={8} animation="wave" />
                  <Skeleton height={32} width="60%" animation="wave" />
                </Flex>
              </View>
            </Card>
          )}
          {previewResults.map((result, i) => (
            <Flex direction="column" gap="size-100" key={i} width="100%">
              {result.kind === "success" ? (
                <Card
                  title="Evaluator Result"
                  width="100%"
                  extra={
                    <IconButton size="S" onPress={() => setPreviewResults([])}>
                      <Icon svg={<Icons.CloseOutline />} />
                    </IconButton>
                  }
                >
                  <AnnotationPreviewJSONBlock annotation={result.annotation} />
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

          {error && !isLoading && previewResults.length === 0 && (
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

      {/* Test button and description */}
      <Flex justifyContent="space-between" alignItems="center">
        <Heading weight="heavy" level={3}>
          Test Evaluator
        </Heading>
        <Button
          size="S"
          onPress={onTestEvaluator}
          isPending={isLoading}
          variant="primary"
          leadingVisual={
            <Icon
              svg={
                isLoading ? (
                  <Icons.LoadingOutline />
                ) : (
                  <Icons.PlayCircleOutline />
                )
              }
            />
          }
        >
          {isLoading ? "Testing..." : "Test"}
        </Button>
      </Flex>
      <Text color="text-500" size="XS">
        Run your evaluator against the example data to verify it works correctly
        before saving.
      </Text>
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
