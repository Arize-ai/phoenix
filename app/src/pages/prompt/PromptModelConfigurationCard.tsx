import React from "react";
import { graphql, useFragment } from "react-relay";

import { Card } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components";
import { PromptModelConfigurationCard__main$key } from "@phoenix/pages/prompt/__generated__/PromptModelConfigurationCard__main.graphql";
import { PromptInvocationParameters } from "@phoenix/pages/prompt/PromptInvocationParameters";
import { PromptLLM } from "@phoenix/pages/prompt/PromptLLM";
import { PromptOutputSchema } from "@phoenix/pages/prompt/PromptOutputSchema";
import { PromptTools } from "@phoenix/pages/prompt/PromptTools";

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
        ...PromptOutputSchemaFragment
      }
    `,
    promptVersionFragment
  );
  return (
    <Card
      title="Model Configuration"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <DisclosureGroup
        defaultExpandedKeys={[
          "llm",
          "invocation-parameters",
          "tools",
          "output-schema",
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
        <PromptOutputSchema promptVersion={promptVersion} />
      </DisclosureGroup>
    </Card>
  );
}