import { PropsWithChildren, useMemo } from "react";

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
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
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
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageToolResultPart({
  toolResult,
  isOnlyChild,
}: ChatTemplateMessageToolResultPartProps) {
  const value = useMemo(() => {
    const convertedToolResult = toolResult.toolResult.result;
    return normalizeMessageContent(convertedToolResult);
  }, [toolResult]);
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.toolResult}
      isOnlyChild={isOnlyChild}
    >
      <Flex direction="column">
        <View paddingX="size-200" paddingTop="size-100">
          <Flex direction="column" justifyContent="start" gap="size-100">
            <Text weight="heavy" size="XS">
              Tool ID
            </Text>
            <View paddingX="size-300">
              <Text size="XS">{toolResult.toolResult.toolCallId}</Text>
            </View>
          </Flex>
        </View>
        <Flex direction="column">
          <View paddingX="size-200" paddingTop="size-100">
            <Text weight="heavy" size="XS">
              Tool Result
            </Text>
          </View>
          <TemplateEditorWrap readOnly>
            <TemplateEditor
              readOnly
              height="100%"
              defaultValue={value}
              templateFormat={TemplateFormats.NONE}
            />
          </TemplateEditorWrap>
        </Flex>
      </Flex>
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageToolCallPartProps = {
  toolCall: ToolCallPart;
  provider: ModelProvider;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageToolCallPart({
  provider,
  toolCall,
  isOnlyChild,
}: ChatTemplateMessageToolCallPartProps) {
  const value = useMemo(() => {
    const convertedToolCall = fromPromptToolCallPart(toolCall, provider);
    return safelyStringifyJSON(convertedToolCall, null, 2).json || "";
  }, [provider, toolCall]);
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.toolCall}
      isOnlyChild={isOnlyChild}
    >
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          defaultValue={value}
          templateFormat={TemplateFormats.NONE}
        />
      </TemplateEditorWrap>
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageTextPartProps = {
  text: string;
  templateFormat: TemplateFormat;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageTextPart(
  props: ChatTemplateMessageTextPartProps
) {
  const { text, templateFormat, isOnlyChild } = props;
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.text}
      isOnlyChild={isOnlyChild}
    >
      <TemplateEditorWrap readOnly>
        <TemplateEditor
          readOnly
          height="100%"
          defaultValue={text}
          templateFormat={templateFormat}
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
  isOnlyChild,
}: PropsWithChildren<{ title?: string; isOnlyChild?: boolean }>) {
  if (isOnlyChild) {
    return <>{children}</>;
  }
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
 *   <ChatTemplateMessageTextPart text="Hello, world!" templateFormat={TemplateFormats.NONE} />
 *   <ChatTemplateMessageToolCallPart toolCall={toolCall} provider={provider} />
 *   <ChatTemplateMessageToolResultPart toolResult={toolResult} />
 * </ChatTemplateMessageCard>
 */
export function ChatTemplateMessageCard(props: ChatTemplateMessageProps) {
  const { role, children } = props;
  const styles = useChatMessageStyles(role);
  return (
    <Card
      title={role}
      variant="compact"
      {...styles}
      bodyStyle={{ padding: 0 }}
      collapsible
    >
      <DisclosureGroup defaultExpandedKeys={PART_TYPE_TITLES}>
        {children}
      </DisclosureGroup>
    </Card>
  );
}
