import { useState } from "react";
import { graphql, useMutation } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  Flex,
  Heading,
  Loading,
  Popover,
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import { type Annotation } from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
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
          annotations {
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
    setError(null);
    setPreviewAnnotations([]);
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
          setPreviewAnnotations(
            response.evaluatorPreviews.annotations.map((annotation) => ({
              id: annotation.id,
              name: annotation.name,
              label: annotation.label,
              score: annotation.score,
              explanation: annotation.explanation,
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
        <Button
          onPress={onTestEvaluator}
          isPending={isLoadingEvaluatorPreview}
          css={css`
            min-width: 64px;
          `}
        >
          {isLoadingEvaluatorPreview ? <Loading size="S" /> : "Test"}
        </Button>
        {isLoadingEvaluatorPreview ? (
          <Skeleton width="100%" height="100%" animation="wave" />
        ) : (
          <Flex direction="row" gap="size-100">
            {previewAnnotations.map((annotation, i) => (
              <DialogTrigger key={`${annotation.id}-${i}`}>
                <ExperimentAnnotationButton annotation={annotation} />
                <Popover>
                  <View padding="size-200">
                    <AnnotationDetailsContent annotation={annotation} />
                  </View>
                </Popover>
              </DialogTrigger>
            ))}
          </Flex>
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
