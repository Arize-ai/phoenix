import { css } from "@emotion/react";
import { useMemo } from "react";

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
import { getToolSchemaDisplayParts } from "./utils";

/**
 * A card displaying a single tool available to the LLM — its name and
 * description when the definition carries them, and its JSON schema.
 */
function LLMToolSchema({
  toolSchema,
  index,
}: {
  toolSchema: string;
  index: number;
}) {
  const { name, description } = useMemo(
    () => getToolSchemaDisplayParts(toolSchema),
    [toolSchema]
  );
  const titleEl = (
    <Flex direction="row" gap="size-100" alignItems="center">
      <SpanKindIcon spanKind="tool" />
      <Text weight="heavy">{name != null ? `Tool: ${name}` : "Tool"}</Text>
    </Flex>
  );

  return (
    <Card
      title={titleEl}
      titleExtra={<Counter>#{index + 1}</Counter>}
      {...defaultCardProps}
      backgroundColor="yellow-100"
      borderColor="yellow-300"
      extra={<CopyToClipboardButton text={toolSchema} />}
    >
      {description != null ? (
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
            <Text>{description}</Text>
          </Flex>
        </View>
      ) : null}
      <MimeTypeCodeBlock value={toolSchema} mimeType={"json"} />
    </Card>
  );
}

/**
 * A list of the tools available to the LLM.
 */
export function LLMToolSchemasList({ toolSchemas }: { toolSchemas: string[] }) {
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-200);
      `}
    >
      {toolSchemas.map((toolSchema, idx) => {
        return (
          <li key={idx}>
            <LLMToolSchema toolSchema={toolSchema} index={idx} />
          </li>
        );
      })}
    </ul>
  );
}
