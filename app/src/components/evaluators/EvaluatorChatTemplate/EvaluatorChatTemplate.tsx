import { useMemo } from "react";

import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundTemplate } from "@phoenix/pages/playground/PlaygroundTemplate";
import { extractPathsFromDatasetExamples } from "@phoenix/utils/objectUtils";

export const EvaluatorChatTemplate = () => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  const example = useEvaluatorStore((state) => state.evaluatorMappingSource);
  const availablePaths = useMemo(() => {
    return extractPathsFromDatasetExamples(
      [
        {
          input: example.input,
          taskOutput: example.output,
          reference: example.reference,
          metadata: example.metadata,
        },
      ],
      null
    );
  }, [example]);
  return (
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
  );
};
