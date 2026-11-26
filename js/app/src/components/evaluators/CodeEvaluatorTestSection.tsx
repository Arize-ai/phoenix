import { useEffect } from "react";

import { createTestCodeEvaluatorDraftClientAction } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import { testCodeEvaluatorDraftOperation } from "@phoenix/agent/uiOperations/operations/codeEvaluatorDraft";
import {
  Alert,
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import {
  AnnotationPreviewCard,
  AnnotationPreviewSkeletonCard,
} from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import {
  type EvaluatorPreviewRequest,
  useEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

/**
 * The preview request for a code evaluator draft. Throws the message to show
 * when the draft cannot run yet.
 */
function buildCodeEvaluatorPreviewRequest({
  evaluatorStore,
  sourceCode,
  language,
  sandboxConfigId,
}: {
  evaluatorStore: ReturnType<typeof useEvaluatorStoreInstance>;
  sourceCode: string;
  language: CodeEvaluatorLanguage;
  sandboxConfigId: string | null;
}): EvaluatorPreviewRequest {
  if (!sourceCode.trim()) {
    throw new Error("Source code is required");
  }
  const { evaluator, outputConfigs } = evaluatorStore.getState();
  if (outputConfigs.length === 0) {
    throw new Error("At least one output configuration is required");
  }
  if (sandboxConfigId == null) {
    throw new Error(
      "Please select a sandbox configuration to test the evaluator"
    );
  }
  return {
    evaluator: {
      inlineCodeEvaluator: {
        name: evaluator.name || evaluator.globalName || "evaluator",
        description: evaluator.description || null,
        language,
        sourceCode,
        outputConfigs: buildOutputConfigsInput(outputConfigs),
        sandboxConfigId,
      },
    },
    inputMapping: evaluator.inputMapping,
  };
}

export type CodeEvaluatorTestSectionProps = {
  /** The evaluator's source code */
  sourceCode: string;
  /** The language (PYTHON or TYPESCRIPT) */
  language: CodeEvaluatorLanguage;
  /** The sandbox config Relay ID if selected */
  sandboxConfigId: string | null;
  isDraftMounted: () => boolean;
};

/**
 * Test section for code evaluators - allows testing the evaluator
 * against example data before saving.
 */
export const CodeEvaluatorTestSection = ({
  sourceCode,
  language,
  sandboxConfigId,
  isDraftMounted,
}: CodeEvaluatorTestSectionProps) => {
  const evaluatorStore = useEvaluatorStoreInstance();
  const {
    run,
    isRunning: isLoading,
    results: previewResults,
    error,
    clearResults,
    clearError,
  } = useEvaluatorPreview();

  const agentStore = useAgentStore();
  useEffect(() => {
    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: testCodeEvaluatorDraftOperation,
          handler: createTestCodeEvaluatorDraftClientAction({
            isDraftMounted,
            runEvaluatorPreview: () =>
              run(() =>
                buildCodeEvaluatorPreviewRequest({
                  evaluatorStore,
                  sourceCode,
                  language,
                  sandboxConfigId,
                })
              ),
          }),
        },
      ],
    });
  }, [
    agentStore,
    isDraftMounted,
    run,
    evaluatorStore,
    sourceCode,
    language,
    sandboxConfigId,
  ]);

  const onTestEvaluator = () => {
    void run(() =>
      buildCodeEvaluatorPreviewRequest({
        evaluatorStore,
        sourceCode,
        language,
        sandboxConfigId,
      })
    );
  };

  const isShowingPreview =
    isLoading || previewResults.length > 0 || error != null;

  return (
    <Flex direction="column" gap="size-100">
      {/* Results section */}
      {isShowingPreview && (
        <Flex direction="column" gap="size-100" marginBottom="size-100">
          {isLoading && (
            <AnnotationPreviewSkeletonCard title="Evaluator Result" />
          )}
          {previewResults.map((result, i) => (
            <Flex direction="column" gap="size-100" key={i} width="100%">
              {result.kind === "success" ? (
                <AnnotationPreviewCard
                  title="Evaluator Result"
                  annotation={result.annotation}
                  extra={
                    <IconButton
                      aria-label="Dismiss evaluator result"
                      size="S"
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

          {error && !isLoading && previewResults.length === 0 && (
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

      {/* Description and test button */}
      <Flex justifyContent="space-between" alignItems="center" gap="size-200">
        <Text color="text-500" size="XS">
          Run your evaluator against the example data to verify it works
          correctly before saving.
        </Text>
        <Button
          size="S"
          onPress={onTestEvaluator}
          isPending={isLoading}
          variant="primary"
          leadingVisual={
            <Icon svg={isLoading ? <Icons.Loading /> : <Icons.PlayCircle />} />
          }
        >
          {isLoading ? "Testing..." : "Test"}
        </Button>
      </Flex>
    </Flex>
  );
};
