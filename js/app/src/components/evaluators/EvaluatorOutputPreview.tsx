import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import invariant from "tiny-invariant";

import { createTestLlmEvaluatorDraftClientAction } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import { testLlmEvaluatorDraftOperation } from "@phoenix/agent/uiOperations/operations/llmEvaluatorDraft";
import {
  Alert,
  Button,
  Card,
  Dialog,
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
import { JSONBlock } from "@phoenix/components/code";
import type { InlineLLMEvaluatorInput } from "@phoenix/components/evaluators/__generated__/useEvaluatorPreviewSubscription.graphql";
import {
  type EvaluationPreviewResult,
  type EvaluatorPreviewSubjectResult,
  toEvaluationPreviewResults,
  useSingleSubjectEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import {
  createLLMEvaluatorPayload,
  getOutputConfigOptimizationValue,
} from "@phoenix/components/evaluators/utils";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";

/** What the agent's test tool reads: the selected example's results. */
type EvaluatorPreviewOutput = Pick<EvaluatorPreviewSubjectResult, "results">;

export const EvaluatorOutputPreview = () => {
  const [error, setError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    EvaluationPreviewResult[]
  >([]);
  const evaluatorStore = useEvaluatorStoreInstance();
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  const playgroundStore = usePlaygroundStore();
  const credentials = useCredentialsContext((state) => state);
  const previewEvaluator = useSingleSubjectEvaluatorPreview();
  const [isLoadingEvaluatorPreview, setIsLoadingEvaluatorPreview] =
    useState(false);
  const runEvaluatorPreview = useCallback(async (): Promise<
    { ok: true; output: EvaluatorPreviewOutput } | { ok: false; error: string }
  > => {
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
      invariant(
        state.outputConfigs.length > 0,
        "at least one output config is required"
      );
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        description: state.evaluator.description,
        name: state.evaluator.name || state.evaluator.globalName,
        includeExplanation: state.evaluator.includeExplanation,
        inputMapping: state.evaluator.inputMapping,
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

    setIsLoadingEvaluatorPreview(true);
    const preview = await previewEvaluator({
      context: state.evaluatorMappingSource.source,
      evaluator: params,
      inputMapping: state.evaluator.inputMapping,
      credentials: toGqlCredentials(credentials),
    });
    setIsLoadingEvaluatorPreview(false);
    if (!preview.ok) {
      setError(preview.error);
      return preview;
    }
    setPreviewResults(toEvaluationPreviewResults(preview.result));
    return { ok: true, output: { results: preview.result.results } };
  }, [credentials, evaluatorStore, playgroundStore, previewEvaluator]);

  const agentStore = useAgentStore();
  const isLlmEvaluator = evaluatorKind === "LLM";
  useEffect(() => {
    if (!isLlmEvaluator) {
      return undefined;
    }
    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: testLlmEvaluatorDraftOperation,
          handler: createTestLlmEvaluatorDraftClientAction({
            isDraftMounted: () => true,
            runEvaluatorPreview,
          }),
        },
      ],
    });
  }, [agentStore, isLlmEvaluator, runEvaluatorPreview]);

  const onTestEvaluator = () => {
    void runEvaluatorPreview();
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
            {isLoadingEvaluatorPreview && <AnnotationPreviewSkeletonCard />}
            {previewResults.map((result, i) => (
              <Flex direction="column" gap="size-100" key={i} width="100%">
                {result.kind === "success" ? (
                  <AnnotationPreviewCard
                    annotation={result.annotation}
                    extra={
                      <IconButton
                        size="S"
                        onPress={() => setPreviewResults([])}
                      >
                        <Icon svg={<Icons.Close />} />
                      </IconButton>
                    }
                  />
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

/**
 * The annotation chip that opens the annotation's details in a popover, with
 * the positive/negative optimization direction derived from the evaluator
 * store's output configs.
 */
export function AnnotationPreviewPopoverButton(props: {
  annotation: Annotation;
  /** Hug the annotation content; see {@link ExperimentAnnotationButton}. */
  compact?: boolean;
}) {
  const { annotation, compact } = props;
  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const evaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName
  );
  return (
    <DialogTrigger>
      <ExperimentAnnotationButton
        annotation={annotation}
        compact={compact}
        optimizationValue={
          getOutputConfigOptimizationValue({
            annotationName: annotation.name,
            score: annotation.score,
            evaluatorName,
            outputConfigs,
          }) ?? undefined
        }
      />
      <Popover>
        <Dialog style={{ width: 400 }}>
          <View padding="size-200">
            <AnnotationDetailsContent annotation={annotation} />
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** The annotation preview card shown while a test is in flight. */
export function AnnotationPreviewSkeletonCard(props: { title?: string }) {
  const { title = "Evaluator Annotation Preview" } = props;
  return (
    <Card title={title}>
      <View padding="size-100">
        <Flex direction="column" gap="size-100">
          <Skeleton height={144} borderRadius="medium" />
          <Skeleton height={44} width="80%" />
        </Flex>
      </View>
    </Card>
  );
}

/** The annotation preview card for a finished test run. */
export function AnnotationPreviewCard(props: {
  annotation: Annotation;
  extra?: ReactNode;
  title?: string;
}) {
  const { annotation, extra, title = "Evaluator Annotation Preview" } = props;
  return (
    <Card title={title} width="100%" extra={extra}>
      <AnnotationPreviewJSONBlock annotation={annotation} />
      <View padding="size-100">
        <AnnotationPreviewPopoverButton annotation={annotation} />
      </View>
    </Card>
  );
}

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
