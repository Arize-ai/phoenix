import { graphql, useFragment } from "react-relay";

import { LLMDisclosure } from "@phoenix/components/generative";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import type { PromptLLM__main$key } from "@phoenix/pages/prompt/__generated__/PromptLLM__main.graphql";

type PromptLLMProps = {
  promptVersion: PromptLLM__main$key;
};

export function PromptLLM({ promptVersion }: PromptLLMProps) {
  const data = useFragment<PromptLLM__main$key>(
    graphql`
      fragment PromptLLM__main on PromptVersion {
        model: modelName
        provider: modelProvider
      }
    `,
    promptVersion
  );
  return (
    <LLMDisclosure
      model={data.model}
      provider={ModelProviders[data.provider as ModelProvider] ?? data.provider}
    />
  );
}
