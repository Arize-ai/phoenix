import { Key, Suspense, useCallback, useEffect, useState } from "react";
import { useRelayEnvironment } from "react-relay";
import {
  graphql,
  GraphQLSubscriptionConfig,
  requestSubscription,
} from "relay-runtime";

import { Card, Loading, View } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { useNotifyError } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";
import { isStringKeyedObject, Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelaySubscriptionError } from "@phoenix/utils/errorUtils";

import PlaygroundOutputSubscription, {
  PlaygroundOutputSubscription as PlaygroundOutputSubscriptionType,
  PlaygroundOutputSubscription$data,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import { PlaygroundErrorWrap } from "./PlaygroundErrorWrap";
import { PlaygroundOutputMoveButton } from "./PlaygroundOutputMoveButton";
import {
  PartialOutputToolCall,
  PlaygroundToolCall,
} from "./PlaygroundToolCall";
import { getChatCompletionInput, isChatMessages } from "./playgroundUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

/**
 * A chat message with potentially partial tool calls, for when tool calls are being streamed back to the client
 */
type PlaygroundOutputMessage = Omit<ChatMessage, "toolCalls"> & {
  toolCalls?: ChatMessage["toolCalls"] | readonly PartialOutputToolCall[];
};

const getToolCallKey = (
  toolCall:
    | NonNullable<ChatMessage["toolCalls"]>[number]
    | PartialOutputToolCall[]
): Key => {
  if (
    isStringKeyedObject(toolCall) &&
    "id" in toolCall &&
    (typeof toolCall.id === "string" || typeof toolCall.id === "number")
  ) {
    return toolCall.id;
  } else if (
    isStringKeyedObject(toolCall) &&
    "toolUse" in toolCall &&
    isStringKeyedObject(toolCall.toolUse) &&
    "toolUseId" in toolCall.toolUse &&
    (typeof toolCall.toolUse.toolUseId === "string" ||
      typeof toolCall.toolUse.toolUseId === "number")
  ) {
    return toolCall.toolUse.toolUseId;
  }
  return JSON.stringify(toolCall);
};

function PlaygroundOutputMessage({
  message,
}: {
  message: PlaygroundOutputMessage;
}) {
  const { role, content, toolCalls } = message;
  const styles = useChatMessageStyles(role);

  return (
    <Card title={role} {...styles} extra={<ConnectedMarkdownModeSelect />}>
      {content != null && !Array.isArray(content) && (
        <ConnectedMarkdownBlock>{content}</ConnectedMarkdownBlock>
      )}

      {toolCalls && toolCalls.length > 0
        ? toolCalls.map((toolCall) => {
            return (
              <View
                key={`tool-call-${getToolCallKey(toolCall)}`}
                paddingX="size-200"
                paddingY="size-200"
                borderTopWidth="thin"
                borderTopColor="blue-500"
              >
                <PlaygroundToolCall
                  key={getToolCallKey(toolCall)}
                  toolCall={toolCall}
                />
              </View>
            );
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
  const credentials = useCredentialsContext((state) => state);
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  const instance = instances.find((instance) => instance.id === instanceId);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const [outputError, setOutputError] = useState<{
    title: string;
    message?: string;
  } | null>(null);

  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const environment = useRelayEnvironment();

  const playgroundStore = usePlaygroundStore();

  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [loading, setLoading] = useState(false);

  const hasRunId = instance?.activeRunId != null;
  const notifyErrorToast = useNotifyError();

  const notifyError = useCallback(
    ({ title, message, ...rest }: Parameters<typeof notifyErrorToast>[0]) => {
      setOutputError({ title, message });
      notifyErrorToast({
        title,
        message,
        ...rest,
      });
    },
    [notifyErrorToast]
  );

  const [outputContent, setOutputContent] = useState<OutputContent>(
    instance.output
  );
  const [toolCalls, setToolCalls] = useState<readonly PartialOutputToolCall[]>(
    []
  );

  const onNext = useCallback(
    ({ chatCompletion }: PlaygroundOutputSubscription$data) => {
      setLoading(false);
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
      if (
        chatCompletion.__typename === "ChatCompletionSubscriptionResult" &&
        chatCompletion.span != null
      ) {
        updateInstance({
          instanceId,
          patch: {
            spanId: chatCompletion.span.id,
          },
          dirty: null,
        });
        return;
      }
      if (chatCompletion.__typename === "ChatCompletionSubscriptionError") {
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        if (chatCompletion.message != null) {
          notifyError({
            title: "Chat completion failed",
            message: chatCompletion.message,
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

  const cleanup = useCallback(() => {
    setOutputContent(undefined);
    setToolCalls([]);
    setOutputError(null);
    updateInstance({
      instanceId,
      patch: {
        spanId: null,
      },
      dirty: null,
    });
  }, [instanceId, updateInstance]);

  useEffect(() => {
    if (!hasRunId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    cleanup();
    const input = getChatCompletionInput({
      playgroundStore,
      instanceId,
      credentials,
    });

    const config: GraphQLSubscriptionConfig<PlaygroundOutputSubscriptionType> =
      {
        subscription: PlaygroundOutputSubscription,
        variables: {
          input,
        },
        onNext: (response) => {
          if (response) {
            onNext(response);
          }
        },
        onCompleted: () => {
          setLoading(false);
          markPlaygroundInstanceComplete(props.playgroundInstanceId);
        },
        onError: (error) => {
          setLoading(false);
          markPlaygroundInstanceComplete(props.playgroundInstanceId);
          const errorMessages =
            getErrorMessagesFromRelaySubscriptionError(error);
          if (errorMessages != null && errorMessages.length > 0) {
            notifyError({
              title: "Failed to get output",
              message: errorMessages.join("\n"),
            });
          } else {
            notifyError({
              title: "Failed to get output",
              message: error.message,
            });
          }
        },
      };
    const subscription = requestSubscription(environment, config);
    return subscription.dispose;
  }, [
    cleanup,
    credentials,
    environment,
    hasRunId,
    instanceId,
    markPlaygroundInstanceComplete,
    notifyError,
    onNext,
    playgroundStore,
    props.playgroundInstanceId,
    updateInstance,
  ]);

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      extra={
        outputContent != null || toolCalls?.length > 0 ? (
          <PlaygroundOutputMoveButton
            outputContent={outputContent}
            toolCalls={toolCalls as Mutable<typeof toolCalls>}
            instance={instance}
            cleanupOutput={cleanup}
          />
        ) : null
      }
      collapsible
    >
      {loading ? (
        <View padding="size-200">
          <Loading message="Running..." />
        </View>
      ) : outputError ? (
        <View padding="size-200">
          <PlaygroundErrorWrap>{outputError.message}</PlaygroundErrorWrap>
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

graphql`
  subscription PlaygroundOutputSubscription($input: ChatCompletionInput!) {
    chatCompletion(input: $input) {
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
      ... on ChatCompletionSubscriptionResult {
        span {
          id
        }
      }
      ... on ChatCompletionSubscriptionError {
        message
      }
    }
  }
`;
