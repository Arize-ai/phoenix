import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Counter,
  Flex,
  Text,
} from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace";

import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";

/**
 * A card displaying a single tool JSON schema available to the LLM.
 */
function LLMToolSchema({
  toolSchema,
  index,
}: {
  toolSchema: string;
  index: number;
}) {
  const titleEl = (
    <Flex direction="row" gap="size-100" alignItems="center">
      <SpanKindIcon spanKind="tool" />
      <Text weight="heavy">Tool</Text>
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
      <MimeTypeCodeBlock value={toolSchema} mimeType={"json"} />
    </Card>
  );
}

/**
 * A list of the tool JSON schemas available to the LLM.
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
