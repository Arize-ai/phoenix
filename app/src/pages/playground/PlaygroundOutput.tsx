import React, { Suspense, useMemo, useState } from "react";
import { useSubscription } from "react-relay";
import { graphql, GraphQLSubscriptionConfig } from "relay-runtime";
import { css } from "@emotion/react";

import { Card, Flex, Icon, Icons, View } from "@arizeai/components";

import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeRadioGroup,
  MarkdownDisplayProvider,
  useMarkdownMode,
} from "@phoenix/components/markdown";
import { useNotifyError } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { OpenAIToolCall } from "@phoenix/schemas/toolCallSchemas";
import { ChatMessage, generateMessageId } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  InvocationParameterInput,
  PlaygroundOutputSubscription,
  PlaygroundOutputSubscription$data,
  PlaygroundOutputSubscription$variables,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import { isChatMessages } from "./playgroundUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

function PlaygroundOutputMessage({ message }: { message: ChatMessage }) {
  const { role, content, toolCalls } = message;
  const styles = useChatMessageStyles(role);
  const { mode: markdownMode } = useMarkdownMode();

  return (
    <Card
      title={role}
      {...styles}
      variant="compact"
      extra={<ConnectedMarkdownModeRadioGroup />}
    >
      {content != null && (
        <Flex direction="column" alignItems="start">
          {markdownMode === "text" ? (
            content
          ) : (
            <View overflow="auto" maxWidth="100%">
              <ConnectedMarkdownBlock>{content}</ConnectedMarkdownBlock>
            </View>
          )}
        </Flex>
      )}
      {toolCalls && toolCalls.length > 0
        ? toolCalls.map((toolCall) => {
            return (
              <pre
                key={toolCall.id}
                css={css`
                  text-wrap: wrap;
                  margin: var(--ac-global-dimension-static-size-100) 0;
                `}
              >
                {toolCall.function.name}(
                {JSON.stringify(
                  typeof toolCall.function.arguments === "string"
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments,
                  null,
                  2
                )}
                )
              </pre>
            );
          })
        : null}
    </Card>
  );
}

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)
  );
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }

  const runId = instance.activeRunId;
  const hasRunId = runId !== null;

  const OutputEl = useMemo(() => {
    if (hasRunId) {
      return (
        <PlaygroundOutputText key={runId} playgroundInstanceId={instanceId} />
      );
    }
    if (isChatMessages(instance.output)) {
      const messages = instance.output;

      return messages.map((message, index) => {
        return <PlaygroundOutputMessage key={index} message={message} />;
      });
    }
    if (typeof instance.output === "string") {
      return (
        <PlaygroundOutputMessage
          message={{
            id: generateMessageId(),
            content: instance.output,
            role: "ai",
          }}
        />
      );
    }
    return "click run to see output";
  }, [hasRunId, instance.output, instanceId, runId]);

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      collapsible
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <View padding="size-200">
        <MarkdownDisplayProvider>{OutputEl}</MarkdownDisplayProvider>
      </View>
      <Suspense>
        {instance.spanId ? (
          <RunMetadataFooter spanId={instance.spanId} />
        ) : null}
      </Suspense>
    </Card>
  );
}

function useChatCompletionSubscription({
  params,
  runId,
  onNext,
  onCompleted,
  onFailed,
}: {
  params: PlaygroundOutputSubscription$variables;
  runId: number;
  onNext: (response: PlaygroundOutputSubscription$data) => void;
  onCompleted: () => void;
  onFailed: (error: Error) => void;
}) {
  const config = useMemo<
    GraphQLSubscriptionConfig<PlaygroundOutputSubscription>
  >(
    () => ({
      subscription: graphql`
        subscription PlaygroundOutputSubscription(
          $messages: [ChatCompletionMessageInput!]!
          $model: GenerativeModelInput!
          $invocationParameters: [InvocationParameterInput!]!
          $tools: [JSON!]
          $templateOptions: TemplateOptions
          $apiKey: String
        ) {
          chatCompletion(
            input: {
              messages: $messages
              model: $model
              invocationParameters: $invocationParameters
              tools: $tools
              template: $templateOptions
              apiKey: $apiKey
            }
          ) {
            __typename
            ... on TextChunk {
              content
            }
            ... on ToolCallChunk {
              id
              function {
                name
                arguments
              }
            }
            ... on FinishedChatCompletion {
              span {
                id
              }
              errorMessage
            }
          }
        }
      `,
      variables: params,
      onNext: (response) => {
        if (response) {
          onNext(response);
        }
      },
      onCompleted: () => {
        onCompleted();
      },
      onError: (error) => {
        onFailed(error);
      },
    }),
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId]
  );
  return useSubscription(config);
}

/**
 * A utility function to convert playground messages content to GQL chat completion message input
 */
function toGqlChatCompletionMessage(
  message: ChatMessage
): ChatCompletionMessageInput {
  return {
    content: message.content,
    role: toGqlChatCompletionRole(message.role),
    toolCalls: message.toolCalls,
    toolCallId: message.toolCallId,
  };
}

function toGqlChatCompletionRole(
  role: ChatMessageRole
): ChatCompletionMessageRole {
  switch (role) {
    case "system":
      return "SYSTEM";
    case "user":
      return "USER";
    case "tool":
      return "TOOL";
    case "ai":
      return "AI";
    default:
      assertUnreachable(role);
  }
}

function PlaygroundOutputText(props: PlaygroundInstanceProps) {
  const instances = usePlaygroundContext((state) => state.instances);
  const credentials = useCredentialsContext((state) => state);
  const instance = instances.find(
    (instance) => instance.id === props.playgroundInstanceId
  );
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const { variablesMap: templateVariables } = useDerivedPlaygroundVariables();
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const notifyError = useNotifyError();
  if (!instance) {
    throw new Error("No instance found");
  }
  if (typeof instance.activeRunId !== "number") {
    throw new Error("No message found");
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [output, setOutput] = useState<string | undefined>(undefined);
  const [toolCalls, setToolCalls] = useState<OpenAIToolCall[]>([]);

  const azureModelParams =
    instance.model.provider === "AZURE_OPENAI"
      ? {
          endpoint: instance.model.endpoint,
          apiVersion: instance.model.apiVersion,
        }
      : {};

  const invocationParameters: InvocationParameterInput[] = [
    ...instance.model.invocationParameters,
    // TODO(apowell): add toolChoice to invocation parameters
    // {
    //   invocationName: "toolChoice",
    //   valueString: instance.toolChoice, // this doesn't work because toolChoice may be json
    // },
  ];

  useChatCompletionSubscription({
    params: {
      messages: instance.template.messages.map(toGqlChatCompletionMessage),
      model: {
        providerKey: instance.model.provider,
        name: instance.model.modelName || "",
        ...azureModelParams,
      },
      invocationParameters,
      templateOptions: {
        variables: templateVariables,
        language: templateLanguage,
      },
      tools: instance.tools.length
        ? instance.tools.map((tool) => tool.definition)
        : undefined,
      apiKey: credentials[instance.model.provider],
    },
    runId: instance.activeRunId,
    onNext: (response) => {
      const chatCompletion = response.chatCompletion;
      if (chatCompletion.__typename === "TextChunk") {
        setOutput((acc) => (acc || "") + chatCompletion.content);
      } else if (chatCompletion.__typename === "ToolCallChunk") {
        setToolCalls((toolCalls) => {
          let toolCallExists = false;
          const updated = toolCalls.map((toolCall) => {
            if (toolCall.id === chatCompletion.id) {
              toolCallExists = true;
              return {
                ...toolCall,
                function: {
                  ...toolCall.function,
                  arguments:
                    toolCall.function.arguments +
                    chatCompletion.function.arguments,
                },
              };
            } else {
              return toolCall;
            }
          });
          if (!toolCallExists) {
            updated.push({
              id: chatCompletion.id,
              function: {
                name: chatCompletion.function.name,
                arguments: chatCompletion.function.arguments,
              },
            });
          }
          return updated;
        });
      } else if (chatCompletion.__typename === "FinishedChatCompletion") {
        updateInstance({
          instanceId: props.playgroundInstanceId,
          patch: {
            spanId: chatCompletion.span.id,
          },
        });
        if (chatCompletion.errorMessage != null) {
          notifyError({
            title: "Chat completion failed",
            message: chatCompletion.errorMessage,
          });
        }
      }
    },
    onCompleted: () => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
    },
    onFailed: (error) => {
      // TODO(apowell): We should display this error to the user after formatting it nicely.
      // eslint-disable-next-line no-console
      console.error(error);
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      updateInstance({
        instanceId: props.playgroundInstanceId,
        patch: {
          activeRunId: null,
        },
      });
      notifyError({
        title: "Failed to get output",
        message: "Please try again.",
      });
    },
  });

  if (instance.isRunning) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.LoadingOutline />} />
        Running...
      </Flex>
    );
  }
  if (output || toolCalls.length) {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          content: output,
          role: "ai",
          toolCalls: toolCalls,
        }}
      />
    );
  }
  return "";
}
