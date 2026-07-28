import {
  MessageAttributePostfixes,
  SemanticAttributePrefixes,
} from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ErrorBoundary,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";
import {
  formatContentAsString,
  safelyParseJSON,
} from "@phoenix/utils/jsonUtils";

import { defaultCardProps } from "./constants";
import { MessageContentsList } from "./MessageContentsList";

/**
 * Displays a single LLM message (input or output) including its contents,
 * tool calls, and function calls.
 */
export function LLMMessage({ message }: { message: AttributeMessage }) {
  const messageContent = message[MessageAttributePostfixes.content];
  const normalizedContent = formatContentAsString(messageContent, {
    unquotePlainString: true,
  });
  // as of multi-modal models, a message can also be a list
  const messagesContents = message[MessageAttributePostfixes.contents];
  const toolCalls = message[MessageAttributePostfixes.tool_calls]
    ?.map((obj) => obj[SemanticAttributePrefixes.tool_call])
    .filter(Boolean);
  const hasFunctionCall =
    message[MessageAttributePostfixes.function_call_arguments_json] &&
    message[MessageAttributePostfixes.function_call_name];
  const role = message[MessageAttributePostfixes.role] || "unknown";
  const messageStyles = useChatMessageStyles(role);
  const toolCallDisclosureIds =
    toolCalls?.map((_, idx) => `tool-call-${idx}`) || [];
  const toolResultId = message[MessageAttributePostfixes.tool_call_id];

  return (
    <MarkdownDisplayProvider>
      <Card
        {...defaultCardProps}
        {...messageStyles}
        title={
          role +
          (message[MessageAttributePostfixes.name]
            ? `: ${message[MessageAttributePostfixes.name]}`
            : "")
        }
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <ConnectedMarkdownModeSelect />
            <CopyToClipboardButton
              text={messageContent || JSON.stringify(message)}
            />
          </Flex>
        }
      >
        <ErrorBoundary>
          {messagesContents ? (
            <MessageContentsList messageContents={messagesContents} />
          ) : null}
        </ErrorBoundary>
        <Flex direction="column" alignItems="start">
          <DisclosureGroup
            css={css`
              width: 100%;
              // when any .disclosure__trigger is hovered, show the child .copy-to-clipboard-button
              .disclosure__trigger {
                width: 100%;
                .copy-to-clipboard-button {
                  visibility: hidden;
                }
              }
              .disclosure__trigger:hover,
              .disclosure__trigger:focus-within,
              .disclosure__trigger:focus-visible {
                .copy-to-clipboard-button {
                  visibility: visible;
                }
              }
            `}
            defaultExpandedKeys={[
              "tool-content",
              ...toolCallDisclosureIds,
              "function-call",
            ]}
          >
            {/* when the message is a tool result, show the tool result in a disclosure */}
            {role.toLowerCase() === "tool" ? (
              <Disclosure id="tool-content">
                <DisclosureTrigger
                  arrowPosition={messageContent ? "start" : "none"}
                  justifyContent="space-between"
                >
                  <Text>
                    Tool Result{toolResultId ? `: ${toolResultId}` : ""}
                  </Text>
                  {toolResultId ? (
                    <CopyToClipboardButton text={toolResultId} />
                  ) : null}
                </DisclosureTrigger>
                <DisclosurePanel>
                  {messageContent ? (
                    <View width="100%">
                      <ConnectedMarkdownBlock>
                        {normalizedContent}
                      </ConnectedMarkdownBlock>
                    </View>
                  ) : null}
                </DisclosurePanel>
              </Disclosure>
            ) : // when the message is any other kind, just show the content without a disclosure
            messageContent ? (
              <View width="100%">
                <ConnectedMarkdownBlock>
                  {normalizedContent}
                </ConnectedMarkdownBlock>
              </View>
            ) : null}
            {(toolCalls?.length ?? 0) > 0
              ? toolCalls?.map((toolCall, idx) => {
                  if (!toolCall) {
                    return null;
                  }
                  const id = toolCall.id;
                  const parsedArguments = safelyParseJSON(
                    toolCall?.function?.arguments as string
                  );

                  return (
                    <Disclosure
                      key={idx}
                      id={toolCallDisclosureIds[idx]}
                      css={
                        idx === 0
                          ? css`
                              border-top: 1px solid
                                var(--global-border-color-default);
                            `
                          : null
                      }
                    >
                      <DisclosureTrigger
                        arrowPosition="start"
                        justifyContent="space-between"
                      >
                        <span>Tool Call{id ? `: ${id}` : ""}</span>
                        {id ? <CopyToClipboardButton text={id} /> : null}
                      </DisclosureTrigger>
                      <DisclosurePanel>
                        <pre
                          key={idx}
                          css={css`
                            text-wrap: wrap;
                            margin: 0;
                            padding: var(--global-dimension-size-200);
                          `}
                        >
                          {toolCall?.function?.name as string}(
                          {parsedArguments.json
                            ? JSON.stringify(parsedArguments.json, null, 2)
                            : `${toolCall?.function?.arguments}`}
                          )
                        </pre>
                      </DisclosurePanel>
                    </Disclosure>
                  );
                })
              : null}
            {/*functionCall is deprecated and is superseded by toolCalls, so we don't expect both to be present*/}
            {hasFunctionCall ? (
              <Disclosure id="function-call">
                <DisclosureTrigger>
                  <Text>Function Call</Text>
                </DisclosureTrigger>
                <DisclosurePanel>
                  <pre
                    css={css`
                      text-wrap: wrap;
                      margin: var(--global-dimension-size-100) 0;
                    `}
                  >
                    {
                      message[
                        MessageAttributePostfixes.function_call_name
                      ] as string
                    }
                    (
                    {JSON.stringify(
                      JSON.parse(
                        message[
                          MessageAttributePostfixes.function_call_arguments_json
                        ] as string
                      ),
                      null,
                      2
                    )}
                    )
                  </pre>
                </DisclosurePanel>
              </Disclosure>
            ) : null}
          </DisclosureGroup>
        </Flex>
      </Card>
    </MarkdownDisplayProvider>
  );
}
