import React, { PropsWithChildren, useMemo } from "react";

import { Card } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { normalizeMessageAttributeValue } from "@phoenix/pages/playground/playgroundUtils";
import { ToolCallPart, ToolResultPart } from "@phoenix/schemas/promptSchemas";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

const PART_TYPE_TITLE = {
  text: "Text",
  toolCall: "Tool Call",
  toolResult: "Tool Result",
} as const;
const PART_TYPE_TITLES = Object.values(PART_TYPE_TITLE);

export type ChatTemplateMessageToolResultProps = {
  toolResult: ToolResultPart;
};

export function ChatTemplateMessageToolResult({
  toolResult,
}: ChatTemplateMessageToolResultProps) {
  const value = useMemo(() => {
    const convertedToolResult = toolResult.toolResult.result;
    return normalizeMessageAttributeValue(convertedToolResult);
  }, [toolResult]);
  return (
    <ChatTemplateMessagePart title={PART_TYPE_TITLE.toolResult}>
      <Flex direction="column">
        <View paddingX="size-200" paddingTop="size-100">
          <Flex
            direction="row"
            justifyContent="start"
            alignItems="center"
            gap="size-200"
          >
            <Text weight="heavy" size="XS">
              Tool ID
            </Text>
            <Text size="XS">{toolResult.toolResult.toolCallId}</Text>
          </Flex>
        </View>
        <TemplateEditorWrap readOnly>
          <TemplateEditor
            readOnly
            height="100%"
            value={value}
            templateLanguage={TemplateLanguages.NONE}
          />
        </TemplateEditorWrap>
      </Flex>
    </ChatTemplateMessagePart>
  );
}

export type ChatTemplateMessageToolCallProps = {
  toolCall: ToolCallPart;
  provider: ModelProvider;
};

export function ChatTemplateMessageToolCall({
  provider,
  toolCall,
}: ChatTemplateMessageToolCallProps) {
  const value = useMemo(() => {
    const convertedToolCall = fromPromptToolCallPart(toolCall, provider);
    return safelyStringifyJSON(convertedToolCall, null, 2).json || "";
  }, [provider, toolCall]);
  return (
    <ChatTemplateMessagePart title={PART_TYPE_TITLE.toolCall}>
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          value={value}
          templateLanguage={TemplateLanguages.NONE}
        />
      </TemplateEditorWrap>
    </ChatTemplateMessagePart>
  );
}

export type ChatTemplateMessageTextProps = {
  text: string;
  templateFormat: TemplateLanguage;
};

export function ChatTemplateMessageText(props: ChatTemplateMessageTextProps) {
  const { text, templateFormat } = props;
  return (
    <ChatTemplateMessagePart title={PART_TYPE_TITLE.text}>
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          value={text}
          templateLanguage={templateFormat}
        />
      </TemplateEditorWrap>
    </ChatTemplateMessagePart>
  );
}

export function ChatTemplateMessagePart({
  title,
  children,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <Disclosure id={title}>
      <DisclosureTrigger>
        <Text weight="heavy" size="S">
          {title}
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}

export type ChatTemplateMessageProps = PropsWithChildren<{
  role: string;
}>;

/**
 * A Read-Only CodeMirror component for the chat template message
 * E.x. a system or user message template part
 */
export function ChatTemplateMessage(props: ChatTemplateMessageProps) {
  const { role, children } = props;
  const styles = useChatMessageStyles(role);
  return (
    <Card title={role} variant="compact" {...styles} bodyStyle={{ padding: 0 }}>
      <DisclosureGroup defaultExpandedKeys={PART_TYPE_TITLES}>
        {children}
      </DisclosureGroup>
    </Card>
  );
}
