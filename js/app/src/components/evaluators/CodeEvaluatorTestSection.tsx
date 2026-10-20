import { useCallback, useEffect, useState } from "react";

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
  type EvaluationPreviewResult,
  type EvaluatorPreviewSubjectResult,
  toEvaluationPreviewResults,
  useSingleSubjectEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import { buildOutputConfigsInput } from "@phoenix/components/evaluators/utils";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

/** What the agent's test tool reads: the selected example's results. */
type EvaluatorPreviewOutput = Pick<EvaluatorPreviewSubjectResult, "results">;

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

  const testEvaluator = useSingleSubjectEvaluatorPreview();
  const [isLoading, setIsLoading] = useState(false);

  const runEvaluatorPreview = useCallback(async (): Promise<
    { ok: true; output: EvaluatorPreviewOutput } | { ok: false; error: string }
  > => {
    setError(null);
    setPreviewResults([]);

    if (!sourceCode.trim()) {
      const errorMessage = "Source code is required";
      setError(errorMessage);
      return { ok: false, error: errorMessage };
    }

    if (outputConfigs.length === 0) {
      const errorMessage = "At least one output configuration is required";
      setError(errorMessage);
      return { ok: false, error: errorMessage };
    }

    if (sandboxConfigId == null) {
      const errorMessage =
        "Please select a sandbox configuration to test the evaluator";
      setError(errorMessage);
      return { ok: false, error: errorMessage };
    }

    const gqlOutputConfigs = buildOutputConfigsInput(outputConfigs);
    setIsLoading(true);
    const preview = await testEvaluator({
      context: evaluatorMappingSource.source,
      evaluator: {
        inlineCodeEvaluator: {
          name: evaluatorName,
          description: evaluatorDescription || null,
          language,
          sourceCode,
          outputConfigs: gqlOutputConfigs,
          sandboxConfigId,
        },
      },
      inputMapping,
    });
    setIsLoading(false);
    if (!preview.ok) {
      setError(preview.error);
      return preview;
    }
    setPreviewResults(toEvaluationPreviewResults(preview.result));
    return { ok: true, output: { results: preview.result.results } };
  }, [
    evaluatorDescription,
    evaluatorMappingSource,
    evaluatorName,
    inputMapping,
    language,
    outputConfigs,
    sandboxConfigId,
    sourceCode,
    testEvaluator,
  ]);

  const agentStore = useAgentStore();
  useEffect(() => {
    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: testCodeEvaluatorDraftOperation,
          handler: createTestCodeEvaluatorDraftClientAction({
            isDraftMounted,
            runEvaluatorPreview,
          }),
        },
      ],
    });
  }, [agentStore, isDraftMounted, runEvaluatorPreview]);

  const onTestEvaluator = () => {
    void runEvaluatorPreview();
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
