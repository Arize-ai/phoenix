import { useMemo } from "react";

import { materializeEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import { getEvaluatorSlotDefaults } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { TemplateEvaluatorContextProvider } from "@phoenix/components/templateEditor/TemplateEvaluatorContext";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundTemplate } from "@phoenix/pages/playground/PlaygroundTemplate";
import { extractPathsFromDatasetExamples } from "@phoenix/utils/objectUtils";

export const EvaluatorChatTemplate = () => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const example = evaluatorMappingSource.source;
  const availablePaths = useMemo(() => {
    return extractPathsFromDatasetExamples(
      [
        {
          input: example.input,
          taskOutput: example.output,
          metadata: "metadata" in example ? example.metadata : {},
          ...("reference" in example ? { reference: example.reference } : {}),
        },
      ],
      null
    );
  }, [example]);
  // A dataset evaluator's template has no record behind it, so it keeps the
  // flat path list; a project evaluator's completes what it actually receives.
  const evaluationContext = useMemo(() => {
    const grain = evaluatorMappingSource.grain;
    return grain === "dataset"
      ? null
      : materializeEvaluatorContext({
          grain,
          evaluatorMappingSource,
          inputMapping,
          slotDefaults: getEvaluatorSlotDefaults(grain),
        });
  }, [evaluatorMappingSource, inputMapping]);
  return (
    <TemplateEvaluatorContextProvider value={evaluationContext}>
      <PlaygroundTemplate
        playgroundInstanceId={instanceId}
        availablePaths={availablePaths}
        disablePromptSave
        disableResponseFormat
        disableNewTool
        disableTools
        disableAlphabeticIndex
        disableEphemeralRouting
      />
    </TemplateEvaluatorContextProvider>
  );
};
