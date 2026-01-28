import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundTemplate } from "@phoenix/pages/playground/PlaygroundTemplate";

export const EvaluatorChatTemplate = () => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  return (
    <PlaygroundTemplate
      playgroundInstanceId={instanceId}
      disablePromptSave
      disableResponseFormat
      disableNewTool
      disableTools
      disableAlphabeticIndex
      disableEphemeralRouting
    />
  );
};
