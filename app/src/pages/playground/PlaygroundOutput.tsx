import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useRelayEnvironment } from "react-relay";
import {
  graphql,
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";

import { Card, Flex, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";
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
import {
  ChatMessage,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  PlaygroundOutputMutation,
  PlaygroundOutputMutation$data,
} from "./__generated__/PlaygroundOutputMutation.graphql";
import {
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  InvocationParameterInput,
  PlaygroundOutputSubscription,
  PlaygroundOutputSubscription$data,
  PlaygroundOutputSubscription$variables,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import {
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
  TOOL_CHOICE_PARAM_NAME,
} from "./constants";
import {
  PartialOutputToolCall,
  PlaygroundToolCall,
} from "./PlaygroundToolCall";
import { isChatMessages } from "./playgroundUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

/**
 * A chat message with potentially partial tool calls, for when tool calls are being streamed back to the client
 */
type PlaygroundOutputMessage = Omit<ChatMessage, "toolCalls"> & {
  toolCalls?: ChatMessage["toolCalls"] | readonly PartialOutputToolCall[];
};

function PlaygroundOutputMessage({
  message,
}: {
  message: PlaygroundOutputMessage;
}) {
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
            return <PlaygroundToolCall key={toolCall.id} toolCall={toolCall} />;
          })
        : null}
    </Card>
  );
}

function PlaygroundOutputContent({
  content,
  partialToolCalls,
}: {
  content: OutputContent;
  partialToolCalls: readonly PartialOutputToolCall[];
}) {
  if (isChatMessages(content)) {
    return content.map((message, index) => {
      return <PlaygroundOutputMessage key={index} message={message} />;
    });
  }
  if (typeof content === "string" || partialToolCalls.length > 0) {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          content,
          role: "ai",
          toolCalls: partialToolCalls,
        }}
      />
    );
  }
  return "click run to see output";
}

type OutputContent = PlaygroundInstance["output"];

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const streaming = usePlaygroundContext((state) => state.streaming);
  const credentials = useCredentialsContext((state) => state);
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  const instance = instances.find((instance) => instance.id === instanceId);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const { variablesMap: templateVariables } = useDerivedPlaygroundVariables();
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [generateChatCompletion] = useMutation<PlaygroundOutputMutation>(
    graphql`
      mutation PlaygroundOutputMutation($input: ChatCompletionInput!) {
        chatCompletion(input: $input) {
          __typename
          content
          errorMessage
          span {
            id
          }
          toolCalls {
            id
            function {
              name
              arguments
            }
          }
        }
      }
    `
  );

  const hasRunId = instance?.activeRunId != null;
  const notifyError = useNotifyError();
  const chatCompletionParams = useMemo(() => {
    if (instance.template.__type !== "chat") {
      throw new Error("We only support chat templates for now");
    }
    let invocationParameters: InvocationParameterInput[] = [
      ...instance.model.invocationParameters,
    ];
    if (instance.tools.length > 0) {
      invocationParameters.push({
        invocationName: TOOL_CHOICE_PARAM_NAME,
        valueJson: instance.toolChoice,
      });
    } else {
      invocationParameters = invocationParameters.filter(
        (param) =>
          param.invocationName !== TOOL_CHOICE_PARAM_NAME &&
          param.canonicalName !== TOOL_CHOICE_PARAM_CANONICAL_NAME
      );
    }
    const azureModelParams =
      instance.model.provider === "AZURE_OPENAI"
        ? {
            endpoint: instance.model.endpoint,
            apiVersion: instance.model.apiVersion,
          }
        : {};

    return {
      messages: instance.template.messages.map(toGqlChatCompletionMessage),
      model: {
        providerKey: instance.model.provider,
        name: instance.model.modelName || "",
        ...azureModelParams,
      },
      invocationParameters: invocationParameters,
      template: {
        variables: templateVariables,
        language: templateLanguage,
      },
      tools: instance.tools.length
        ? instance.tools.map((tool) => tool.definition)
        : undefined,
      apiKey: credentials[instance.model.provider],
    };
  }, [
    credentials,
    instance.model.apiVersion,
    instance.model.endpoint,
    instance.model.invocationParameters,
    instance.model.modelName,
    instance.model.provider,
    instance.template.__type,
    instance.template.messages,
    instance.toolChoice,
    instance.tools,
    templateLanguage,
    templateVariables,
  ]);

  const [outputContent, setOutputContent] = useState<OutputContent>(
    instance.output
  );
  const [toolCalls, setToolCalls] = useState<readonly PartialOutputToolCall[]>(
    []
  );

  const onNext = useCallback(
    ({ chatCompletion }: PlaygroundOutputSubscription$data) => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      if (chatCompletion.__typename === "TextChunk") {
        const content = chatCompletion.content;
        setOutputContent((prev) => {
          const newOutput = prev != null ? prev + content : content;
          return newOutput;
        });
        return;
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
        return;
      }
      if (chatCompletion.__typename === "FinishedChatCompletion") {
        updateInstance({
          instanceId,
          patch: {
            spanId: chatCompletion.span.id,
          },
        });
        if (chatCompletion.errorMessage != null) {
          notifyError({
            title: "Chat completion failed",
            message: chatCompletion.errorMessage,
            expireMs: 10000,
          });
        }
      }
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      props.playgroundInstanceId,
      updateInstance,
    ]
  );

  const startStreaming = useChatCompletionSubscription({
    params: chatCompletionParams,
    onNext,
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

  const onCompleted = useCallback(
    (
      response: PlaygroundOutputMutation$data,
      errors: PayloadError[] | null
    ) => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      updateInstance({
        instanceId,
        patch: {
          spanId: response.chatCompletion.span.id,
        },
      });
      if (errors) {
        notifyError({
          title: "Chat completion failed",
          message: errors[0].message,
        });
        return;
      }
      if (response.chatCompletion.errorMessage != null) {
        notifyError({
          title: "Chat completion failed",
          message: response.chatCompletion.errorMessage,
        });
        return;
      }
      setOutputContent(response.chatCompletion.content ?? undefined);
      setToolCalls(response.chatCompletion.toolCalls);
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      props.playgroundInstanceId,
      updateInstance,
    ]
  );

  useEffect(() => {
    if (!hasRunId) {
      return;
    }
    setOutputContent(undefined);
    setToolCalls([]);

    if (streaming) {
      startStreaming();
      return;
    }
    generateChatCompletion({
      variables: {
        input: chatCompletionParams,
      },
      onCompleted,
      onError(error) {
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        notifyError({
          title: "Failed to get output",
          message: error.message,
        });
      },
    });
    // Remove startSubscription from dependencies as its reference is not stable and we don't want to restart the subscription when it changes
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatCompletionParams,
    credentials,
    generateChatCompletion,
    hasRunId,
    instance,
    instanceId,
    markPlaygroundInstanceComplete,
    notifyError,
    onCompleted,
    props.playgroundInstanceId,
    streaming,
    templateLanguage,
    templateVariables,
    updateInstance,
  ]);

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="OutputContent" />}
      collapsible
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      {hasRunId ? (
        <View padding="size-200">
          <Loading message="Running..." />
        </View>
      ) : (
        <>
          <View padding="size-200">
            <MarkdownDisplayProvider>
              <PlaygroundOutputContent
                content={outputContent}
                partialToolCalls={toolCalls}
              />
            </MarkdownDisplayProvider>
          </View>
          <Suspense>
            {instance.spanId ? (
              <RunMetadataFooter spanId={instance.spanId} />
            ) : null}
          </Suspense>
        </>
      )}
    </Card>
  );
}

function useChatCompletionSubscription({
  params,
  onNext,
  onCompleted,
  onFailed,
}: {
  params: PlaygroundOutputSubscription$variables;
  onNext: (response: PlaygroundOutputSubscription$data) => void;
  onCompleted: () => void;
  onFailed: (error: Error) => void;
}) {
  const environment = useRelayEnvironment();
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
          $template: TemplateOptions
          $apiKey: String
        ) {
          chatCompletion(
            input: {
              messages: $messages
              model: $model
              invocationParameters: $invocationParameters
              tools: $tools
              template: $template
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
            }
            ... on ChatCompletionSubscriptionError {
              message
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
    [onCompleted, onFailed, onNext, params]
  );
  const startStreaming = useCallback(() => {
    const subscription = requestSubscription(environment, config);
    return () => subscription.dispose();
  }, [config, environment]);

  return startStreaming;
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
