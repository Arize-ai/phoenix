import { graphql, useFragment } from "react-relay";

import {
  Card,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components";
import type { PromptModelConfigurationCard__main$key } from "@phoenix/features/prompts-settings/pages/prompt/__generated__/PromptModelConfigurationCard__main.graphql";
import { PromptInvocationParameters } from "@phoenix/features/prompts-settings/pages/prompt/PromptInvocationParameters";
import { PromptLLM } from "@phoenix/features/prompts-settings/pages/prompt/PromptLLM";
import { PromptResponseFormat } from "@phoenix/features/prompts-settings/pages/prompt/PromptResponseFormat";
import { PromptTools } from "@phoenix/features/prompts-settings/pages/prompt/PromptTools";

export function PromptModelConfigurationCard({
  promptVersion: promptVersionFragment,
}: {
  promptVersion: PromptModelConfigurationCard__main$key;
}) {
  const promptVersion = useFragment<PromptModelConfigurationCard__main$key>(
    graphql`
      fragment PromptModelConfigurationCard__main on PromptVersion {
        model: modelName
        provider: modelProvider
        ...PromptLLM__main
        ...PromptInvocationParameters__main
        ...PromptTools__main
        ...PromptResponseFormatFragment
      }
    `,
    promptVersionFragment
  );
  return (
    <Card title="Model Configuration" collapsible>
      <DisclosureGroup
        defaultExpandedKeys={[
          "llm",
          "invocation-parameters",
          "tools",
          "response-format",
        ]}
      >
        <PromptLLM promptVersion={promptVersion} />
        <Disclosure id="invocation-parameters">
          <DisclosureTrigger>Invocation Parameters</DisclosureTrigger>
          <DisclosurePanel>
            <PromptInvocationParameters promptVersion={promptVersion} />
          </DisclosurePanel>
        </Disclosure>
        <PromptTools promptVersion={promptVersion} />
        <PromptResponseFormat promptVersion={promptVersion} />
      </DisclosureGroup>
    </Card>
  );
}
