import { fetchPlaygroundPromptAsInstance } from "@phoenix/components/playground/fetchPlaygroundPrompt";
import { PromptMenu } from "@phoenix/components/playground/PromptMenu";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

/**
 * Picks a saved prompt version for an instance and loads it into the
 * instance's template and model.
 */
export function InstancePromptMenu({ instanceId }: { instanceId: number }) {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const loadInstance = usePlaygroundContext((state) => state.loadInstance);
  const setTemplateFormat = usePlaygroundContext(
    (state) => state.setTemplateFormat
  );
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const prompt = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.prompt
  );
  const promptId = prompt?.id;
  const promptVersionId = prompt?.version;
  const promptTagName = prompt?.tag ?? null;

  const promptMenuValue =
    promptId && promptVersionId
      ? { promptId, promptVersionId, promptTagName }
      : null;

  const onChangePrompt = async ({
    promptId,
    promptVersionId,
    promptTagName,
  }: {
    promptId: string | null;
    promptVersionId: string | null;
    promptTagName: string | null;
  }) => {
    if (!promptId && !promptVersionId && !promptTagName) {
      updateInstance({ instanceId, patch: { prompt: null }, dirty: false });
      return;
    }

    const response = await fetchPlaygroundPromptAsInstance({
      promptId,
      promptVersionId,
      tagName: promptTagName,
    });
    if (response) {
      if (numInstances <= 1) {
        setTemplateFormat(
          response.promptVersion.templateFormat as Parameters<
            typeof setTemplateFormat
          >[0]
        );
      }
      loadInstance({ instanceId, instance: response.instance });
    }
  };

  return <PromptMenu value={promptMenuValue} onChange={onChangePrompt} />;
}
