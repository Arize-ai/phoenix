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
import { PromptTools } from "@phoenix/pages/prompt/PromptTools";

export function PromptModelConfigurationCard({
  promptVersion: promptVersionFragment,
}: {
  promptVersion: PromptModelConfigurationCard__main$key;
}) {
  const promptVersion = useFragment<PromptModelConfigurationCard__main$key>(
    graphql`
      fragment PromptModelConfigurationCard__main on PromptVersion {
        ...PromptInvocationParameters__main
        ...PromptTools__main
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
      <DisclosureGroup defaultExpandedKeys={["invocation-parameters", "tools"]}>
        <Disclosure id="invocation-parameters">
          <DisclosureTrigger>Invocation Parameters</DisclosureTrigger>
          <PromptInvocationParameters promptVersion={promptVersion} />
        </Disclosure>
        <Disclosure id="tools">
          <DisclosureTrigger>Tools</DisclosureTrigger>
          <DisclosurePanel>
            <PromptTools promptVersion={promptVersion} />
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Card>
  );
}
