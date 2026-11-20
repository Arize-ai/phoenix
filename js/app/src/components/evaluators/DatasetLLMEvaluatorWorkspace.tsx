import { Counter, Flex, Text } from "@phoenix/components";
import { EvaluatorDatasetTestPanel } from "@phoenix/components/evaluators/EvaluatorDatasetTestPanel";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { EvaluatorWorkspace } from "@phoenix/components/evaluators/workspace/EvaluatorWorkspace";
import { defineEvaluatorWorkspaceLayout } from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";

type DatasetLLMEvaluatorWorkspacePanelId =
  | "prompt"
  | "annotation"
  | "details"
  | "variables"
  | "test"
  | "example";

/**
 * The LLM dataset evaluator form: the definition on the left with the
 * variable mapping docked under it; the test run and its results on the
 * right with the example it runs against under them. The lower tabsets
 * collapse to their headers.
 */
export const DATASET_LLM_EVALUATOR_WORKSPACE_LAYOUT =
  defineEvaluatorWorkspaceLayout<DatasetLLMEvaluatorWorkspacePanelId>({
    storageKey: "arize-phoenix-dataset-evaluator-workspace-v1",
    panels: {
      prompt: { title: "Prompt" },
      annotation: { title: "Annotation" },
      details: { title: "Details" },
      variables: { title: "Variables" },
      test: { title: "Test" },
      // The preview scrolls its own content and draws to the edges.
      example: { title: "Example", padding: "none", scroll: "self" },
    },
    root: (tab) => ({
      type: "split",
      id: "root",
      orientation: "horizontal",
      children: [
        {
          type: "split",
          id: "left",
          orientation: "vertical",
          size: 50,
          children: [
            {
              type: "tabset",
              id: "definition",
              size: 66,
              minWidth: "380px",
              minHeight: "160px",
              selectedId: "prompt",
              tabs: [tab("prompt"), tab("annotation"), tab("details")],
            },
            {
              type: "tabset",
              id: "mapping",
              size: 34,
              collapsible: true,
              minHeight: "96px",
              tabs: [tab("variables")],
            },
          ],
        },
        {
          type: "split",
          id: "right",
          orientation: "vertical",
          size: 50,
          children: [
            {
              type: "tabset",
              id: "run",
              size: 45,
              minWidth: "380px",
              minHeight: "120px",
              tabs: [tab("test")],
            },
            {
              type: "tabset",
              id: "examples",
              size: 55,
              collapsible: true,
              minHeight: "120px",
              tabs: [tab("example")],
            },
          ],
        },
      ],
    }),
  });

/**
 * The panels of the LLM dataset evaluator form, laid out by
 * {@link DATASET_LLM_EVALUATOR_WORKSPACE_LAYOUT}. Requires `dataset` to be
 * set in the evaluator store.
 */
export const DatasetLLMEvaluatorWorkspace = () => {
  const variables = useEvaluatorInputVariables();
  return (
    <EvaluatorWorkspace<DatasetLLMEvaluatorWorkspacePanelId>
      badges={{
        variables:
          variables.length > 0 ? (
            <Counter variant="quiet" count={variables.length} />
          ) : null,
      }}
      panels={{
        prompt: (
          <LLMEvaluatorForm
            showInputMapping={false}
            showAnnotationConfig={false}
          />
        ),
        annotation: (
          <LLMEvaluatorForm showInputMapping={false} showPrompt={false} />
        ),
        details: <EvaluatorNameAndDescriptionFields />,
        variables: (
          <Flex direction="column" gap="size-200">
            <Text size="S" color="text-500">
              Map evaluator variables to fields on the example. Variables left
              blank are matched to fields of the same name.
            </Text>
            <EvaluatorInputMapping />
          </Flex>
        ),
        test: <EvaluatorDatasetTestPanel showInputPreview={false} />,
        example: <EvaluatorInputPreview />,
      }}
    />
  );
};
