import { PropsWithChildren } from "react";
import { graphql, useFragment } from "react-relay";

import { List, ListItem } from "@arizeai/components";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { PromptLLM__main$key } from "@phoenix/pages/prompt/__generated__/PromptLLM__main.graphql";

const ModelProviderItem = ({
  keyName,
  children,
}: PropsWithChildren<{
  keyName: string;
}>) => (
  <ListItem listSize="small">
    <View paddingStart="size-100" paddingEnd="size-100">
      <Flex direction="row" justifyContent="space-between">
        <Text size="XS" color="text-700">
          {keyName}
        </Text>
        <Text size="XS">{children}</Text>
      </Flex>
    </View>
  </ListItem>
);

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
    <Disclosure id="llm">
      <DisclosureTrigger>LLM</DisclosureTrigger>
      <DisclosurePanel>
        <List listSize="small">
          <ModelProviderItem keyName="Model">{data.model}</ModelProviderItem>
          <ModelProviderItem keyName="Provider">
            {ModelProviders[data.provider as ModelProvider] ?? data.provider}
          </ModelProviderItem>
        </List>
      </DisclosurePanel>
    </Disclosure>
  );
}
