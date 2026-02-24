import { css } from "@emotion/react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  SectionHeading,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import {
  findToolDefinitionDescription,
  findToolDefinitionName,
} from "@phoenix/features/playground/schemas/toolSchemas";
import type { PromptTools__main$key } from "@phoenix/features/prompts-settings/pages/prompt/__generated__/PromptTools__main.graphql";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

type ToolDefinitionItem = {
  name: string;
  description?: string;
  definition: string;
};

export function PromptTools({
  promptVersion,
}: {
  promptVersion: PromptTools__main$key;
}) {
  const { tools } = useFragment<PromptTools__main$key>(
    graphql`
      fragment PromptTools__main on PromptVersion {
        tools {
          definition
        }
      }
    `,
    promptVersion
  );

  const items: ToolDefinitionItem[] = useMemo(() => {
    return tools.map((tool, i) => {
      const definition = tool.definition;
      return {
        name: findToolDefinitionName(definition) || `Tool ${i + 1}`,
        description: findToolDefinitionDescription(definition) || undefined,
        definition: safelyStringifyJSON(definition, null, 2).json || "{}",
      };
    });
  }, [tools]);

  if (items.length === 0) {
    return (
      <Disclosure id="tools">
        <DisclosureTrigger>Tools</DisclosureTrigger>
        <DisclosurePanel>
          <View padding="size-200">
            <Flex justifyContent="center" alignItems="center">
              <Text color="text-300">No tools specified for this prompt</Text>
            </Flex>
          </View>
        </DisclosurePanel>
      </Disclosure>
    );
  }

  return (
    <Flex direction="column">
      <SectionHeading bordered={false}>Tools</SectionHeading>
      <DisclosureGroup
        css={css`
          & {
            > .disclosure:last-child {
              &[data-expanded="true"] {
                border-bottom: 1px solid var(--global-border-color-default);
              }
            }
          }
        `}
      >
        {items.map((item, i) => (
          <Disclosure key={`${item.name}-${i}`} id={`tool-${i}`}>
            <DisclosureTrigger
              arrowPosition="start"
              justifyContent="space-between"
            >
              <Text>{item.name}</Text>
              <Text>{item.description}</Text>
            </DisclosureTrigger>
            <DisclosurePanel>
              <JSONBlock value={item.definition} />
            </DisclosurePanel>
          </Disclosure>
        ))}
      </DisclosureGroup>
    </Flex>
  );
}
