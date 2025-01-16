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
import { normalizeMessageContent } from "@phoenix/pages/playground/playgroundUtils";
import { ToolCallPart, ToolResultPart } from "@phoenix/schemas/promptSchemas";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

const PART_TYPE_TITLE = {
  text: "Text",
  toolCall: "Tool Call",
  toolResult: "Tool Result",
} as const;
const PART_TYPE_TITLES = Object.values(PART_TYPE_TITLE);

export type ChatTemplateMessageToolResultPartProps = {
  toolResult: ToolResultPart;
};

export function ChatTemplateMessageToolResultPart({
  toolResult,
}: ChatTemplateMessageToolResultPartProps) {
  const value = useMemo(() => {
    const convertedToolResult = toolResult.toolResult.result;
    return normalizeMessageContent(convertedToolResult);
  }, [toolResult]);
  return (
    <ChatTemplateMessagePartContainer title={PART_TYPE_TITLE.toolResult}>
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
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageToolCallPartProps = {
  toolCall: ToolCallPart;
  provider: ModelProvider;
};

export function ChatTemplateMessageToolCallPart({
  provider,
  toolCall,
}: ChatTemplateMessageToolCallPartProps) {
  const value = useMemo(() => {
    const convertedToolCall = fromPromptToolCallPart(toolCall, provider);
    return safelyStringifyJSON(convertedToolCall, null, 2).json || "";
  }, [provider, toolCall]);
  return (
    <ChatTemplateMessagePartContainer title={PART_TYPE_TITLE.toolCall}>
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          value={value}
          templateLanguage={TemplateLanguages.NONE}
        />
      </TemplateEditorWrap>
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageTextPartProps = {
  text: string;
  templateFormat: TemplateLanguage;
};

export function ChatTemplateMessageTextPart(
  props: ChatTemplateMessageTextPartProps
) {
  const { text, templateFormat } = props;
  return (
    <ChatTemplateMessagePartContainer title={PART_TYPE_TITLE.text}>
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          value={text}
          templateLanguage={templateFormat}
        />
      </TemplateEditorWrap>
    </ChatTemplateMessagePartContainer>
  );
}

/**
 * Internal container component for ChatTemplateMessage*Type*Part components
 */
function ChatTemplateMessagePartContainer({
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
 * A Card component that represents a template chat message
 *
 * It accepts children, who should be ChatTemplateMessage*Type*Part components
 *
 * @example
 * <ChatTemplateMessageCard role="system">
 *   <ChatTemplateMessageTextPart text="Hello, world!" templateFormat={TemplateLanguages.NONE} />
 *   <ChatTemplateMessageToolCallPart toolCall={toolCall} provider={provider} />
 *   <ChatTemplateMessageToolResultPart toolResult={toolResult} />
 * </ChatTemplateMessageCard>
 */
export function ChatTemplateMessageCard(props: ChatTemplateMessageProps) {
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
