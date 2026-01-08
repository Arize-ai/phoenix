/**
 * A component that shows a preview of the prompt that will be used for the llm evals
 **/

import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import { Card, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import {
  ContentPartInput,
  EvaluatorPromptPreviewQuery,
  PromptChatTemplateInput,
  PromptTemplateFormat,
} from "@phoenix/components/evaluators/__generated__/EvaluatorPromptPreviewQuery.graphql";
import { ErrorBoundary } from "@phoenix/components/exception";
import { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { Skeleton } from "@phoenix/components/loading/Skeleton";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { chatMessageRoleToPromptMessageRole } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { denormalizePlaygroundInstance } from "@phoenix/pages/playground/playgroundUtils";
import {
  findToolCallArguments,
  findToolCallId,
  findToolCallName,
} from "@phoenix/schemas/toolCallSchemas";
import {
  ChatMessage,
  PlaygroundChatTemplate,
} from "@phoenix/store/playground/types";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

/**
 * Converts a ChatMessage to an array of ContentPartInput.
 * Handles text content, tool calls, and tool results.
 */
const chatMessageToContentParts = (
  message: ChatMessage
): ContentPartInput[] => {
  const parts: ContentPartInput[] = [];

  // Handle tool result messages (role === "tool" with toolCallId)
  if (message.role === "tool" && message.toolCallId) {
    parts.push({
      toolResult: {
        toolCallId: message.toolCallId,
        result: message.content ?? "",
      },
    });
    return parts;
  }

  // Handle text content
  if (message.content) {
    parts.push({
      text: { text: message.content },
    });
  }

  // Handle tool calls (typically from AI/assistant messages)
  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const toolCall of message.toolCalls) {
      const toolCallId = findToolCallId(toolCall);
      const toolCallName = findToolCallName(toolCall);
      const toolCallArguments = findToolCallArguments(toolCall);

      if (toolCallId) {
        const argsStr =
          typeof toolCallArguments === "string"
            ? toolCallArguments
            : safelyStringifyJSON(toolCallArguments).json || "";
        parts.push({
          toolCall: {
            toolCallId,
            toolCall: {
              name: toolCallName || toolCallId,
              arguments: argsStr,
            },
          },
        });
      }
    }
  }

  return parts;
};

/**
 * A function that converts a playground chat template to a GQL chat template.
 * This is used to create a preview of the prompt that will be used for the llm evals.
 *
 * Note: this overlaps heavily with the instanceToPromptVersion function in fetchPlaygroundPrompt.ts
 * If used in the future, we should refactor to use the same function.
 */
export function playgroundChatTemplateToGqlPromptChatTemplate(
  template: PlaygroundChatTemplate
): PromptChatTemplateInput {
  return {
    messages: template.messages
      .map((message) => {
        const contentParts = chatMessageToContentParts(message);
        // Skip messages with no content parts
        if (contentParts.length === 0) {
          return null;
        }
        return {
          role: chatMessageRoleToPromptMessageRole(message.role),
          content: contentParts,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null),
  };
}

function EvaluatorPromptPreviewSkeleton({
  messageCount,
}: {
  messageCount: number;
}) {
  return (
    <Flex direction="column" gap="size-200">
      {Array.from({ length: messageCount }).map((_, i) => (
        <Skeleton key={i} height={300} />
      ))}
    </Flex>
  );
}

function EvaluatorPromptPreviewErrorFallback(
  _props: ErrorBoundaryFallbackProps
) {
  return (
    <View padding="size-200">
      <Flex direction="row" gap="size-100" alignItems="start">
        <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
        <Flex direction="column" gap="size-50">
          <Text weight="heavy" color="danger">
            Unable to render template preview
          </Text>
          <Text color="text-700">
            The template variables in your prompt may not match the available
            input mappings or parameters. Please check that all template
            variables (e.g. {"{{input}}"}, {"{{output}}"}, {"{{reference}}"})
            have corresponding values defined.
          </Text>
        </Flex>
      </Flex>
    </View>
  );
}

export function EvaluatorPromptPreview() {
  const instance = usePlaygroundContext((state) => state.instances[0]);
  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);

  // Denormalize the instance to get the full template with messages
  const denormalizedInstance = useMemo(
    () => denormalizePlaygroundInstance(instance, allInstanceMessages),
    [instance, allInstanceMessages]
  );

  invariant(
    denormalizedInstance.template.__type === "chat",
    "Template must be a chat template"
  );

  const chatTemplate = denormalizedInstance.template as PlaygroundChatTemplate;

  // Convert the playground template to a GQL template
  const gqlTemplate = useMemo(
    () => playgroundChatTemplateToGqlPromptChatTemplate(chatTemplate),
    [chatTemplate]
  );

  const messageCount = gqlTemplate.messages.length;

  return (
    <ErrorBoundary fallback={EvaluatorPromptPreviewErrorFallback}>
      <Suspense
        fallback={
          <EvaluatorPromptPreviewSkeleton messageCount={messageCount} />
        }
      >
        <EvaluatorPromptPreviewContent
          gqlTemplate={gqlTemplate}
          templateFormat={templateFormat}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

type EvaluatorPromptPreviewContentProps = {
  gqlTemplate: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
};

function EvaluatorPromptPreviewContent(
  props: EvaluatorPromptPreviewContentProps
) {
  const { gqlTemplate, templateFormat } = props;
  const { inputMappingRaw, preMappedInput } = useEvaluatorStore(
    useShallow((state) => ({
      inputMappingRaw: state.evaluator.inputMapping,
      preMappedInput: state.preMappedInput,
    }))
  );
  // When used as a query input, Relay mutates the object to make it read-only.
  // This causes downstream issues when react-hook-form tries to update the value.
  // To avoid this, we deep clone the object before using it as a query input.
  const inputMapping = structuredClone(inputMappingRaw);
  const data = useLazyLoadQuery<EvaluatorPromptPreviewQuery>(
    graphql`
      query EvaluatorPromptPreviewQuery(
        $template: PromptChatTemplateInput!
        $templateOptions: PromptTemplateOptions!
        $inputMapping: EvaluatorInputMappingInput!
      ) {
        prompt: applyChatTemplate(
          template: $template
          templateOptions: $templateOptions
          inputMapping: $inputMapping
        ) {
          messages {
            role
            content {
              __typename
              ... on TextContentPart {
                text {
                  text
                }
              }
            }
          }
        }
      }
    `,
    {
      template: gqlTemplate,
      templateOptions: {
        variables: preMappedInput ?? {},
        format: templateFormat,
      },
      inputMapping,
    }
  );

  // Display the messages with applied template variables from the query result
  return (
    <Flex direction="column" gap="size-200">
      {data.prompt.messages.map((message, index) => {
        // Extract text content from the message
        const textContent = message.content
          .map((part) => {
            if (part.__typename === "TextContentPart" && part.text) {
              return part.text.text;
            }
            return null;
          })
          .filter(Boolean)
          .join("");

        return (
          <MessageCard key={index} role={message.role} content={textContent} />
        );
      })}
    </Flex>
  );
}

function MessageCard({ role, content }: { role: string; content: string }) {
  const styles = useChatMessageStyles(role as ChatMessage["role"]);
  return (
    <Card title={role} {...styles}>
      <pre
        css={css`
          white-space: pre-wrap;
          padding-left: var(--ac-global-dimension-static-size-200);
          padding-right: var(--ac-global-dimension-static-size-200);
        `}
      >
        {content}
      </pre>
    </Card>
  );
}
