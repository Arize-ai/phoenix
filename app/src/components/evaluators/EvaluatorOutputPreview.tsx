import { useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Button, Flex, Heading, Skeleton, Text } from "@phoenix/components";
import {
  type Annotation,
  AnnotationNameAndValue,
} from "@phoenix/components/annotation";
import type {
  EvaluatorOutputPreviewMutation,
  InlineLLMEvaluatorInput,
} from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import { createLLMEvaluatorPayload } from "@phoenix/components/evaluators/utils";
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

const EvaluatorOutputPreviewContent = () => {
  const [error, setError] = useState<string | null>(null);
  const [previewAnnotations, setPreviewAnnotations] = useState<Annotation[]>(
    []
  );
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const [previewEvaluator, isLoadingEvaluatorPreview] =
    useMutation<EvaluatorOutputPreviewMutation>(graphql`
      mutation EvaluatorOutputPreviewMutation(
        $input: EvaluatorPreviewItemInput!
      ) {
        evaluatorPreviews(input: { previews: [$input] }) {
          results {
            explanation
            label
            score
            name
            id
          }
        }
      }
    `);
  const onTestEvaluator = () => {
    const { instances } = playgroundStore.getState();
    const instanceId = instances[0].id;
    invariant(instanceId != null, "instanceId is required");
    const {
      evaluator: {
        id,
        displayName,
        name,
        description,
        inputMapping,
        includeExplanation,
        isBuiltin,
      },
      outputConfig,
      dataset,
      preMappedInput,
    } = evaluatorStore.getState();
    let params:
      | { inlineLlmEvaluator: InlineLLMEvaluatorInput }
      | { evaluatorId: string };
    if (!isBuiltin) {
      invariant(outputConfig, "outputConfig is required");
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        description,
        name: displayName || name,
        includeExplanation,
        inputMapping,
        outputConfig,
        instanceId,
        datasetId: dataset?.id ?? "",
      });
      params = {
        inlineLlmEvaluator: {
          promptVersion: payload.promptVersion,
          outputConfig,
          description,
          model: {
            builtin: {
              name: payload.promptVersion.modelName,
              providerKey: payload.promptVersion.modelProvider,
            },
          },
        },
      };
    } else {
      invariant(id, "evaluator id is required");
      params = {
        evaluatorId: id,
      };
    }

    previewEvaluator({
      variables: {
        input: {
          contexts: [preMappedInput],
          evaluator: params,
          inputMapping,
        },
      },
      onCompleted(response, errors) {
        if (errors) {
          setError(errors[0].message);
        } else {
          setPreviewAnnotations(
            response.evaluatorPreviews.results.map((result) => ({
              id: result.id,
              name: result.name,
              label: result.label,
              score: result.score,
              explanation: result.explanation,
            }))
          );
        }
      },
      onError(error) {
        setError(error.message);
      },
    });
  };
  return (
    <Flex direction="column" gap="size-100">
      <Flex direction="row" gap="size-100">
        <Button onPress={onTestEvaluator} isPending={isLoadingEvaluatorPreview}>
          Test
        </Button>
        {isLoadingEvaluatorPreview ? (
          <Flex direction="row" gap="size-100">
            {previewAnnotations.map((annotation) => (
              <AnnotationNameAndValue
                key={annotation.id}
                annotation={annotation}
                displayPreference="label"
              />
            ))}
          </Flex>
        ) : (
          <Skeleton width="100%" height="100%" />
        )}
      </Flex>
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
