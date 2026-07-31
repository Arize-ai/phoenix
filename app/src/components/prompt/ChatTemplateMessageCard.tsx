import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { useMemo } from "react";

import {
  Card,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ExternalLink,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import {
  TemplateEditor,
  TemplateEditorWrap,
} from "@phoenix/components/templateEditor";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { SpanImage } from "@phoenix/pages/trace/span";
import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
  ToolCallPart,
  ToolResultPart,
} from "@phoenix/schemas/promptSchemas";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import {
  formatContentAsString,
  safelyStringifyJSON,
} from "@phoenix/utils/jsonUtils";
import { mediaDisplayName, resolveMediaUrl } from "@phoenix/utils/mediaUtils";

const PART_TYPE_TITLE = {
  text: "Text",
  image: "Image",
  imageVariable: "Image Input",
  file: "Document",
  fileVariable: "Document Input",
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
    return formatContentAsString(convertedToolResult);
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

export type ChatTemplateMessageImagePartProps = {
  image: ImagePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageImagePart({
  image,
  isOnlyChild,
}: ChatTemplateMessageImagePartProps) {
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.image}
      isOnlyChild={isOnlyChild}
    >
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <SpanImage url={image.image.url} />
          <Text size="XS" color="text-700">
            {image.image.mediaType}
          </Text>
        </Flex>
      </View>
    </ChatTemplateMessagePartContainer>
  );
}

const variablePillCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  border: 1px solid var(--global-color-primary);
  border-radius: var(--global-rounding-small);
  color: var(--global-color-primary);
  font-family: var(--global-font-family-code);
  font-size: var(--global-dimension-static-font-size-75);
`;

/**
 * The position a piece of media occupies in the message, when the prompt names it
 * rather than storing one.
 *
 * There is nothing to preview — the value arrives with the run's inputs — so this
 * shows which input fills the slot. Without it the part renders as nothing and the
 * message looks like it carries no media at all.
 */
function MediaVariablePart({
  variable,
  title,
  icon,
  isOnlyChild,
}: {
  variable: string;
  title: string;
  icon: ReactNode;
  isOnlyChild?: boolean;
}) {
  return (
    <ChatTemplateMessagePartContainer title={title} isOnlyChild={isOnlyChild}>
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <span css={variablePillCSS}>
            <Icon svg={icon} />
            {`{{${variable}}}`}
          </span>
          <Text size="XS" color="text-700">
            Supplied when the prompt runs
          </Text>
        </Flex>
      </View>
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageImageVariablePartProps = {
  imageVariable: ImageVariablePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageImageVariablePart({
  imageVariable,
  isOnlyChild,
}: ChatTemplateMessageImageVariablePartProps) {
  return (
    <MediaVariablePart
      variable={imageVariable.image.variable}
      title={PART_TYPE_TITLE.imageVariable}
      icon={<Icons.Image />}
      isOnlyChild={isOnlyChild}
    />
  );
}

export type ChatTemplateMessageFileVariablePartProps = {
  fileVariable: FileVariablePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageFileVariablePart({
  fileVariable,
  isOnlyChild,
}: ChatTemplateMessageFileVariablePartProps) {
  return (
    <MediaVariablePart
      variable={fileVariable.file.variable}
      title={PART_TYPE_TITLE.fileVariable}
      icon={<Icons.FileText />}
      isOnlyChild={isOnlyChild}
    />
  );
}

export type ChatTemplateMessageFilePartProps = {
  file: FilePart;
  isOnlyChild?: boolean;
};

/**
 * A document stored on the prompt.
 *
 * Opens in a new tab rather than rendering inline: a PDF viewer is a heavy thing
 * to embed in a template preview, and the useful action here is to check which
 * document the prompt carries.
 */
export function ChatTemplateMessageFilePart({
  file,
  isOnlyChild,
}: ChatTemplateMessageFilePartProps) {
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.file}
      isOnlyChild={isOnlyChild}
    >
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <ExternalLink href={resolveMediaUrl(file.file.url)}>
            <Flex direction="row" gap="size-75" alignItems="center">
              <Icon svg={<Icons.FileText />} />
              {mediaDisplayName(file.file.url, file.file.mediaType)}
            </Flex>
          </ExternalLink>
          <Text size="XS" color="text-700">
            {file.file.mediaType}
          </Text>
        </Flex>
      </View>
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
    <Card title={role} {...styles} collapsible>
      <DisclosureGroup defaultExpandedKeys={PART_TYPE_TITLES}>
        {children}
      </DisclosureGroup>
    </Card>
  );
}
