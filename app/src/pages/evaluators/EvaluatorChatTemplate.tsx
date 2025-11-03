import { PropsWithChildren, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { usePreferencesContext } from "@phoenix/contexts";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import { EvaluatorChatTemplateQuery } from "@phoenix/pages/evaluators/__generated__/EvaluatorChatTemplateQuery.graphql";
import { NoInstalledProvider } from "@phoenix/pages/playground/NoInstalledProvider";
import { PlaygroundTemplate } from "@phoenix/pages/playground/PlaygroundTemplate";

export const EvaluatorChatTemplateProvider = ({
  children,
}: PropsWithChildren) => {
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

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }

  return (
    <PlaygroundProvider modelConfigByProvider={modelConfigByProvider}>
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
      disableTools
      disablePromptMenu
    />
  );
};
