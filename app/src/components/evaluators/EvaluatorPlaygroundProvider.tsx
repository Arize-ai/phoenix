import { PropsWithChildren, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { EvaluatorPlaygroundProviderQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorPlaygroundProviderQuery.graphql";
import { makeLLMEvaluatorInstance } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePreferencesContext } from "@phoenix/contexts";
import { PlaygroundProvider } from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { promptVersionToInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { NoInstalledProvider } from "@phoenix/pages/playground/NoInstalledProvider";
import {
  generateInstanceId,
  type PlaygroundChatTemplate,
} from "@phoenix/store";

export const EvaluatorPlaygroundProvider = ({
  children,
  promptVersionRef,
  promptVersionTag,
  promptName,
  promptId,
  defaultMessages,
  templateFormat,
}: PropsWithChildren<{
  promptId?: string;
  promptName?: string;
  promptVersionRef?: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key;
  promptVersionTag?: string;
  defaultMessages?: PlaygroundChatTemplate["messages"];
  templateFormat?: TemplateFormat;
}>) => {
  const { modelProviders } = useLazyLoadQuery<EvaluatorPlaygroundProviderQuery>(
    graphql`
      query EvaluatorPlaygroundProviderQuery {
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
    return makeLLMEvaluatorInstance({ modelConfigByProvider, defaultMessages });
  }, [
    modelConfigByProvider,
    promptId,
    promptName,
    promptVersionRef,
    promptVersionTag,
    defaultMessages,
  ]);

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }

  return (
    <PlaygroundProvider
      instances={defaultInstances}
      modelConfigByProvider={modelConfigByProvider}
      templateFormat={templateFormat}
    >
      {children}
    </PlaygroundProvider>
  );
};
