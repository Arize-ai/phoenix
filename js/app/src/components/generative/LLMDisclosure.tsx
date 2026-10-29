import type { PropsWithChildren } from "react";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  List,
  ListItem,
  Text,
  View,
} from "@phoenix/components";

const ModelProviderItem = ({
  keyName,
  children,
}: PropsWithChildren<{
  keyName: string;
}>) => (
  <ListItem>
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

/**
 * The "LLM" disclosure of a model configuration card: the model and the
 * provider's display name.
 */
export function LLMDisclosure({
  model,
  provider,
}: {
  model: string;
  provider: string;
}) {
  return (
    <Disclosure id="llm">
      <DisclosureTrigger>LLM</DisclosureTrigger>
      <DisclosurePanel>
        <List size="S">
          <ModelProviderItem keyName="Model">{model}</ModelProviderItem>
          <ModelProviderItem keyName="Provider">{provider}</ModelProviderItem>
        </List>
      </DisclosurePanel>
    </Disclosure>
  );
}
