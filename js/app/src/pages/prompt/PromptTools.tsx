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
import type { PromptTools__main$key } from "@phoenix/pages/prompt/__generated__/PromptTools__main.graphql";
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
  const { tools: toolsData } = useFragment<PromptTools__main$key>(
    graphql`
      fragment PromptTools__main on PromptVersion {
        tools {
          tools {
            __typename
            ... on PromptToolFunction {
              function {
                name
                description
                parameters
                strict
              }
            }
            ... on PromptToolRaw {
              raw
            }
          }
        }
      }
    `,
    promptVersion
  );

  const items: ToolDefinitionItem[] = useMemo(() => {
    if (!toolsData) return [];
    return toolsData.tools.map((tool, i) => {
      const fallbackName = `Tool ${i + 1}`;
      if (tool.__typename === "PromptToolFunction") {
        const fn = tool.function;
        const definition = { type: "function", function: fn };
        return {
          name: fn.name || fallbackName,
          description: fn.description || undefined,
          definition: safelyStringifyJSON(definition, null, 2).json || "{}",
        };
      }
      if (tool.__typename === "PromptToolRaw") {
        const definition = tool.raw;
        const name =
          typeof definition.name === "string"
            ? definition.name
            : typeof definition.type === "string"
              ? definition.type
              : fallbackName;
        return {
          name,
          description: undefined,
          definition: safelyStringifyJSON(definition, null, 2).json || "{}",
        };
      }
      // eslint-disable-next-line no-console
      console.warn(
        `PromptTools: unknown tool __typename "${tool.__typename}" at index ${i}; client may need rebuild`
      );
      return {
        name: `Unknown tool (${fallbackName})`,
        description: "Unsupported tool type — refresh after the client rebuild",
        definition: "{}",
      };
    });
  }, [toolsData]);

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
