import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Counter,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace";

import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { LLMToolDefinition } from "./utils";

/**
 * A card displaying a single tool available to the LLM.
 */
function LLMToolSchema({
  tool,
  index,
}: {
  tool: LLMToolDefinition;
  index: number;
}) {
  const titleEl = (
    <Flex direction="row" gap="size-100" alignItems="center">
      <SpanKindIcon spanKind="tool" />
      <Text weight="heavy">
        {tool.name == null ? "Tool" : `Tool: ${tool.name}`}
      </Text>
    </Flex>
  );

  return (
    <Card
      title={titleEl}
      titleExtra={<Counter>#{index + 1}</Counter>}
      {...defaultCardProps}
      backgroundColor="yellow-100"
      borderColor="yellow-300"
      extra={<CopyToClipboardButton text={tool.jsonSchema} />}
    >
      {tool.description != null ? (
        <View
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderBottomColor="default"
          borderBottomWidth="thin"
        >
          <Flex direction="column" alignItems="start" gap="size-50">
            <Text color="text-700" fontStyle="italic">
              Description
            </Text>
            <Text>{tool.description}</Text>
          </Flex>
        </View>
      ) : null}
      <MimeTypeCodeBlock value={tool.jsonSchema} mimeType={"json"} />
    </Card>
  );
}

/**
 * A list of the tools available to the LLM.
 */
export function LLMToolSchemasList({ tools }: { tools: LLMToolDefinition[] }) {
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-200);
      `}
    >
      {tools.map((tool, idx) => {
        return (
          <li key={idx}>
            <LLMToolSchema tool={tool} index={idx} />
          </li>
        );
      })}
    </ul>
  );
}
