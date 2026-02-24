import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { usePreferencesContext } from "@phoenix/contexts";
import { PlaygroundProvider } from "@phoenix/contexts/PlaygroundContext";
import type { EvaluatorPlaygroundProviderQuery } from "@phoenix/features/experiments/components/evaluators/__generated__/EvaluatorPlaygroundProviderQuery.graphql";
import { makeLLMEvaluatorInstance } from "@phoenix/features/experiments/components/evaluators/EvaluatorChatTemplate/utils";
import type { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/features/playground/pages/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { promptVersionToInstance } from "@phoenix/features/playground/pages/fetchPlaygroundPrompt";
import { NoInstalledProvider } from "@phoenix/features/playground/pages/NoInstalledProvider";
import { TemplateFormats } from "@phoenix/features/prompts-settings/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/features/prompts-settings/components/templateEditor/types";
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
  templateFormat = TemplateFormats.Mustache,
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
