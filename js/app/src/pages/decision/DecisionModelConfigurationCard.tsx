import type { PropsWithChildren } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Card,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  List,
  ListItem,
  Text,
  View,
} from "@phoenix/components";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { DecisionModelConfigurationCard_version$key } from "./__generated__/DecisionModelConfigurationCard_version.graphql";

const ModelConfigurationItem = ({
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
 * The model a decision version runs on. Mirrors the prompt's model
 * configuration card.
 */
export function DecisionModelConfigurationCard({
  decisionVersion,
}: {
  decisionVersion: DecisionModelConfigurationCard_version$key;
}) {
  const data = useFragment<DecisionModelConfigurationCard_version$key>(
    graphql`
      fragment DecisionModelConfigurationCard_version on DecisionVersion {
        modelName
        # Aliased: this fragment shares a node with prompt version fragments,
        # whose modelProvider has a different type
        decisionModelProvider: modelProvider
        customProvider {
          name
        }
      }
    `,
    decisionVersion
  );
  const provider = isModelProvider(data.decisionModelProvider)
    ? ModelProviders[data.decisionModelProvider]
    : data.decisionModelProvider;
  return (
    <Card title="Model Configuration" collapsible>
      <DisclosureGroup defaultExpandedKeys={["model"]}>
        <Disclosure id="model">
          <DisclosureTrigger>Model</DisclosureTrigger>
          <DisclosurePanel>
            <List size="S">
              <ModelConfigurationItem keyName="Model">
                {data.modelName}
              </ModelConfigurationItem>
              <ModelConfigurationItem keyName="Provider">
                {provider}
              </ModelConfigurationItem>
              {data.customProvider ? (
                <ModelConfigurationItem keyName="Custom provider">
                  {data.customProvider.name}
                </ModelConfigurationItem>
              ) : null}
            </List>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Card>
  );
}
