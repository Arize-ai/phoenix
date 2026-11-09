import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
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
import { useEvaluatorPreviewOutputConfigs } from "@phoenix/components/evaluators/EvaluatorPreviewOutputConfigsContext";
import {
  type EvaluatorPreview,
  type EvaluatorPreviewRequest,
  useEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import {
  createLLMEvaluatorPayload,
  getOutputConfigOptimizationValue,
  getTypedOutputConfigOptimizationValue,
} from "@phoenix/components/evaluators/utils";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import type { EvaluatorKind } from "@phoenix/types";

const CODE_PREVIEW_HELP_TEXT =
  "Test your evaluator using an example from your dataset. Use the selected example to map values of the evaluator function arguments to the inputs, outputs, and reference outputs of your dataset and task output.";

const HELP_TEXT_BY_EVALUATOR_KIND: Partial<Record<EvaluatorKind, string>> = {
  LLM: "Test your evaluator using an example from your dataset. Use the selected example to map variables in the evaluator prompt to the inputs, outputs, and reference outputs of your dataset and task output.",
  CODE: CODE_PREVIEW_HELP_TEXT,
  DECISION:
    "Test your evaluator using an example from your dataset. Use the selected example to map variables in the decision's state to the inputs, outputs, and reference outputs of your dataset and task output. Unsaved changes are included.",
};

export function getEvaluatorPreviewHelpText(kind: EvaluatorKind): string {
  return HELP_TEXT_BY_EVALUATOR_KIND[kind] ?? CODE_PREVIEW_HELP_TEXT;
}

/**
 * The preview request for an evaluator the stores describe in full: a
 * built-in evaluator by id, or an LLM evaluator from its judge prompt.
 */
function buildStoreEvaluatorPreviewRequest({
  evaluatorStore,
  playgroundStore,
}: {
  evaluatorStore: ReturnType<typeof useEvaluatorStoreInstance>;
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
}): EvaluatorPreviewRequest {
  const state = evaluatorStore.getState();
  const inputMapping = state.evaluator.inputMapping;
  if (state.evaluator.isBuiltin) {
    invariant(state.evaluator.id, "evaluator id is required");
    return {
      evaluator: { builtInEvaluatorId: state.evaluator.id },
      inputMapping,
    };
  }
  const instanceId = playgroundStore.getState().instances[0].id;
  invariant(instanceId != null, "instanceId is required");
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
  return {
    evaluator: {
      inlineLlmEvaluator: {
        name: payload.name,
        description: payload.description,
        outputConfigs: payload.outputConfigs,
        promptVersion: payload.promptVersion,
      },
    },
    inputMapping,
  };
}

/**
 * The dataset test section for an LLM or built-in evaluator. An LLM draft
 * also offers its test to the agent.
 */
export const EvaluatorOutputPreview = () => {
  const evaluatorStore = useEvaluatorStoreInstance();
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  const playgroundStore = usePlaygroundStore();
  const preview = useEvaluatorPreview();
  const { run } = preview;

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
            runEvaluatorPreview: () =>
              run(() =>
                buildStoreEvaluatorPreviewRequest({
                  evaluatorStore,
                  playgroundStore,
                })
              ),
          }),
        },
      ],
    });
  }, [agentStore, isLlmEvaluator, run, evaluatorStore, playgroundStore]);

  return (
    <EvaluatorPreviewSection
      preview={preview}
      onTest={() =>
        void run(() =>
          buildStoreEvaluatorPreviewRequest({ evaluatorStore, playgroundStore })
        )
      }
      helpText={getEvaluatorPreviewHelpText(evaluatorKind)}
    />
  );
};

/**
 * "Test with an Example": the test button, its help text, and the results of
 * the last run of {@link useEvaluatorPreview}, for any evaluator kind.
 */
export function EvaluatorPreviewSection({
  preview,
  onTest,
  helpText,
  isDisabled = false,
}: {
  preview: EvaluatorPreview;
  onTest: () => void;
  helpText: string;
  isDisabled?: boolean;
}) {
  const { isRunning, results, error, clearResults, clearError } = preview;
  const isShowingPreview = isRunning || results.length > 0 || error != null;
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
            {isRunning && <AnnotationPreviewSkeletonCard />}
            {results.map((result, i) => (
              <Flex direction="column" gap="size-100" key={i} width="100%">
                {result.kind === "success" ? (
                  <AnnotationPreviewCard
                    annotation={result.annotation}
                    extra={
                      <IconButton
                        size="S"
                        aria-label="Clear test results"
                        onPress={clearResults}
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
              onDismissClick={clearError}
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
            onPress={onTest}
            isPending={isRunning}
            isDisabled={isDisabled}
            variant="primary"
            data-testid="evaluator-preview-button"
            leadingVisual={
              <Icon
                svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />}
              />
            }
          >
            {isRunning ? "Testing..." : "Test"}
          </Button>
        </Flex>
        <Text color="text-500">{helpText}</Text>
      </Flex>
    </>
  );
}

/**
 * The annotation chip that opens the annotation's details in a popover, with
 * the positive/negative optimization direction derived from the output
 * configs a form provides (a decision evaluator's, derived from its draft),
 * else the evaluator store's.
 */
export function AnnotationPreviewPopoverButton(props: {
  annotation: Annotation;
  /** Hug the annotation content; see {@link ExperimentAnnotationButton}. */
  compact?: boolean;
  /**
   * Leave out the evaluator's own name, where every chip belongs to the same
   * evaluator: a single-output annotation shows no name, and a multi-output
   * one shows only its output's name.
   */
  omitEvaluatorName?: boolean;
}) {
  const { annotation, compact, omitEvaluatorName = false } = props;
  const provided = useEvaluatorPreviewOutputConfigs();
  const storeOutputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const storeEvaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName
  );
  const optimizationValue = provided
    ? getTypedOutputConfigOptimizationValue({
        annotationName: annotation.name,
        score: annotation.score,
        evaluatorName: provided.evaluatorName ?? storeEvaluatorName,
        outputConfigs: provided.outputConfigs,
      })
    : getOutputConfigOptimizationValue({
        annotationName: annotation.name,
        score: annotation.score,
        evaluatorName: storeEvaluatorName,
        outputConfigs: storeOutputConfigs,
      });
  const evaluatorName = provided?.evaluatorName ?? storeEvaluatorName;
  const displayName = omitEvaluatorName
    ? getNameWithoutEvaluator({
        annotationName: annotation.name,
        evaluatorName,
      })
    : undefined;
  return (
    <DialogTrigger>
      <ExperimentAnnotationButton
        annotation={annotation}
        compact={compact}
        optimizationValue={optimizationValue ?? undefined}
        displayName={displayName}
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

/**
 * An annotation's name less its evaluator's: null when the annotation is
 * named after the evaluator, the output's name when it is
 * `evaluatorName.outputName`, else the annotation's own name.
 */
export function getNameWithoutEvaluator({
  annotationName,
  evaluatorName,
}: {
  annotationName: string;
  evaluatorName: string;
}): string | null {
  if (!evaluatorName) {
    return annotationName;
  }
  if (annotationName === evaluatorName) {
    return null;
  }
  const prefix = `${evaluatorName}.`;
  return annotationName.startsWith(prefix)
    ? annotationName.slice(prefix.length)
    : annotationName;
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
