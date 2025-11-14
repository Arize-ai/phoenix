import { PropsWithChildren, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { EvaluatorChatTemplateQuery } from "@phoenix/components/evaluators/EvaluatorChatTemplate/__generated__/EvaluatorChatTemplateQuery.graphql";
import { makeLLMEvaluatorInstance } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { usePreferencesContext } from "@phoenix/contexts";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { promptVersionToInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { NoInstalledProvider } from "@phoenix/pages/playground/NoInstalledProvider";
import { PlaygroundTemplate } from "@phoenix/pages/playground/PlaygroundTemplate";
import { generateInstanceId } from "@phoenix/store";

export const EvaluatorChatTemplateProvider = ({
  children,
  promptVersionRef,
  promptVersionTag,
  promptName,
  promptId,
}: PropsWithChildren<{
  promptId?: string;
  promptName?: string;
  promptVersionRef?: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key;
  promptVersionTag?: string;
}>) => {
  const { modelProviders } = useLazyLoadQuery<EvaluatorChatTemplateQuery>(
    graphql`
      query EvaluatorChatTemplateQuery {
        modelProviders {
          name
          dependenciesInstalled
          dependencies
        }
      }
    `,
    {}
  );
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  const hasInstalledProvider = modelProviders.some(
    (provider) => provider.dependenciesInstalled
  );

  const defaultInstances = useMemo(() => {
    if (promptId && promptName && promptVersionRef) {
      return [
        {
          ...promptVersionToInstance({
            promptId,
            promptName,
            promptVersionRef,
            promptVersionTag: promptVersionTag ?? null,
            supportedInvocationParameters: [],
          }),
          id: generateInstanceId(),
        },
      ];
    }
    return makeLLMEvaluatorInstance(modelConfigByProvider);
  }, [
    modelConfigByProvider,
    promptId,
    promptName,
    promptVersionRef,
    promptVersionTag,
  ]);

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }

  return (
    <PlaygroundProvider
      instances={defaultInstances}
      modelConfigByProvider={modelConfigByProvider}
    >
      {children}
    </PlaygroundProvider>
  );
};

export const EvaluatorChatTemplate = () => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = useMemo(() => instances[0].id, [instances]);
  return (
    <PlaygroundTemplate
      playgroundInstanceId={instanceId}
      disablePromptSave
      disableResponseFormat
      disableNewTool
      disableTools
    />
  );
};
