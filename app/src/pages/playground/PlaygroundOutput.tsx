import { Key, Suspense, useCallback, useEffect, useState } from "react";
import { useMutation, useRelayEnvironment } from "react-relay";
import {
  graphql,
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";

import { Card, Flex, Loading, View } from "@phoenix/components";
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
  PlaygroundRepetitionOutput,
} from "@phoenix/store";
import { isStringKeyedObject, Mutable } from "@phoenix/typeUtils";
import {
  getErrorMessagesFromRelayMutationError,
  getErrorMessagesFromRelaySubscriptionError,
} from "@phoenix/utils/errorUtils";

import { ExperimentRepetitionSelector } from "../experiment/ExperimentRepetitionSelector";

import PlaygroundOutputMutation, {
  PlaygroundOutputMutation as PlaygroundOutputMutationType,
  PlaygroundOutputMutation$data,
} from "./__generated__/PlaygroundOutputMutation.graphql";
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
type PlaygroundOutputMessageType = Omit<ChatMessage, "toolCalls"> & {
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
  message: PlaygroundOutputMessageType;
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
  output,
  partialToolCalls,
}: {
  output: PlaygroundRepetitionOutput["output"];
  partialToolCalls: readonly PartialOutputToolCall[];
}) {
  if (isChatMessages(output)) {
    return output.map((message, index) => {
      return <PlaygroundOutputMessage key={index} message={message} />;
    });
  }
  if (typeof output === "string") {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          content: output,
          role: "ai",
        }}
      />
    );
  }
  if (partialToolCalls.length > 0) {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          role: "ai",
          toolCalls: partialToolCalls,
        }}
      />
    );
  }
  return "click run to see output";
}

type OutputContentByRepetitionNumber =
  PlaygroundInstance["outputByRepetitionNumber"];

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const streaming = usePlaygroundContext((state) => state.streaming);
  const repetitions = usePlaygroundContext((state) => state.repetitions);
  const credentials = useCredentialsContext((state) => state);
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  const instanceHasMultipleRepetitions = instance.repetitions > 1;
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const [outputError, setOutputError] = useState<{
    title: string;
    message?: string;
  } | null>(null);
  const [selectedRepetitionNumber, setSelectedRepetitionNumber] = useState(1);
  const spanId: string | null | undefined =
    instance.outputByRepetitionNumber[selectedRepetitionNumber]?.spanId;

  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const environment = useRelayEnvironment();

  const playgroundStore = usePlaygroundStore();

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [generateChatCompletion] = useMutation<PlaygroundOutputMutationType>(
    PlaygroundOutputMutation
  );

  const runInProgress = instances.some(
    (instance) => instance.activeRunId != null
  );
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

  const [outputContentByRepetitionNumber, setOutputContentByRepetitionNumber] =
    useState<OutputContentByRepetitionNumber>(
      instance.outputByRepetitionNumber
    );
  const outputContent =
    outputContentByRepetitionNumber[selectedRepetitionNumber];

  const appendOutputContent = useCallback(
    (repetitionNumber: number, content: string) => {
      setOutputContentByRepetitionNumber((prev) => {
        const previousContent = prev[repetitionNumber] ?? {
          output: null,
          spanId: null,
        };
        return {
          ...prev,
          [repetitionNumber]: {
            ...previousContent,
            output: (previousContent.output || "") + content,
            spanId: previousContent.spanId,
          },
        };
      });
    },
    []
  );

  const [toolCallsByRepetitionNumber, setToolCallsByRepetitionNumber] =
    useState<Record<number, readonly PartialOutputToolCall[]>>({});
  const toolCalls: readonly PartialOutputToolCall[] =
    toolCallsByRepetitionNumber[selectedRepetitionNumber] || {};

  const onNext = useCallback(
    ({ chatCompletion }: PlaygroundOutputSubscription$data) => {
      if (chatCompletion.__typename === "TextChunk") {
        const content = chatCompletion.content;
        if (content == null || chatCompletion.repetitionNumber == null) {
          return;
        }
        appendOutputContent(chatCompletion.repetitionNumber, content);
        return;
      } else if (chatCompletion.__typename === "ToolCallChunk") {
        const chatCompletionId = chatCompletion.id;
        const chatCompletionFunction = chatCompletion.function;
        if (chatCompletionFunction == null || chatCompletionId == null) {
          return;
        }
        setToolCallsByRepetitionNumber((prev) => {
          const repetitionNumber = chatCompletion.repetitionNumber ?? 1;
          const toolCallsList = prev[repetitionNumber] ?? [];
          let toolCallExists = false;
          const updated = toolCallsList.map((toolCall) => {
            if (toolCall.id === chatCompletion.id) {
              toolCallExists = true;
              return {
                ...toolCall,
                function: {
                  ...toolCall.function,
                  arguments:
                    toolCall.function.arguments +
                    chatCompletionFunction.arguments,
                },
              };
            } else {
              return toolCall;
            }
          });
          if (!toolCallExists) {
            updated.push({
              id: chatCompletionId,
              function: {
                name: chatCompletionFunction.name,
                arguments: chatCompletionFunction.arguments,
              },
            });
          }
          return {
            ...prev,
            [repetitionNumber]: updated,
          };
        });
        return;
      }
      if (
        chatCompletion.__typename === "ChatCompletionSubscriptionResult" &&
        chatCompletion.span != null
      ) {
        const instance = playgroundStore
          .getState()
          .instances.find((inst) => inst.id === instanceId);
        if (instance == null || chatCompletion.repetitionNumber == null) {
          return;
        }
        const previousOutput = instance.outputByRepetitionNumber[
          chatCompletion.repetitionNumber
        ] ?? { output: null, spanId: null };
        updateInstance({
          instanceId,
          patch: {
            outputByRepetitionNumber: {
              ...instance.outputByRepetitionNumber,
              [chatCompletion.repetitionNumber]: {
                output: previousOutput.output,
                spanId: chatCompletion.span.id,
              },
            },
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
      playgroundStore,
      appendOutputContent,
      props.playgroundInstanceId,
      updateInstance,
    ]
  );

  const onCompleted = useCallback(
    (
      response: PlaygroundOutputMutation$data,
      errors: PayloadError[] | null
    ) => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      const instance = playgroundStore
        .getState()
        .instances.find((inst) => inst.id === instanceId);
      if (instance == null) {
        return;
      }
      updateInstance({
        instanceId,
        patch: {
          outputByRepetitionNumber: {
            ...instance.outputByRepetitionNumber,
            [1]: {
              output: response.chatCompletion.content,
              spanId: response.chatCompletion.span.id,
            },
          },
        },
        dirty: null,
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
      if (response.chatCompletion.content != null) {
        appendOutputContent(
          1, // handle repetitions in mutation
          response.chatCompletion.content
        );
      }
      setToolCallsByRepetitionNumber((prev) => ({
        ...prev,
        [1]: response.chatCompletion.toolCalls, // handle repetitions in mutation
      }));
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      playgroundStore,
      props.playgroundInstanceId,
      appendOutputContent,
      updateInstance,
    ]
  );

  const cleanup = useCallback(() => {
    setSelectedRepetitionNumber(1);
    setOutputContentByRepetitionNumber({});
    setToolCallsByRepetitionNumber({});
    setOutputError(null);
    updateInstance({
      instanceId,
      patch: {},
      dirty: null,
    });
  }, [instanceId, updateInstance]);

  useEffect(() => {
    if (!runInProgress) {
      return;
    }
    cleanup();
    const input = getChatCompletionInput({
      playgroundStore,
      instanceId,
      credentials,
    });

    if (streaming) {
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
            markPlaygroundInstanceComplete(props.playgroundInstanceId);
          },
          onError: (error) => {
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
    }

    const disposable = generateChatCompletion({
      variables: {
        input,
      },
      onCompleted,
      onError(error) {
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
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
    });

    return disposable.dispose;
  }, [
    cleanup,
    credentials,
    environment,
    generateChatCompletion,
    instanceId,
    markPlaygroundInstanceComplete,
    notifyError,
    onCompleted,
    onNext,
    repetitions,
    runInProgress,
    playgroundStore,
    props.playgroundInstanceId,
    streaming,
    updateInstance,
  ]);
  const hasContent =
    outputContentByRepetitionNumber[selectedRepetitionNumber]?.output != null ||
    toolCalls.length > 0;
  const isRepetitionLoading = runInProgress && !hasContent;
  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      extra={
        <Flex direction="row" gap="size-150" alignItems="center">
          {instanceHasMultipleRepetitions && (
            <ExperimentRepetitionSelector
              repetitionNumber={selectedRepetitionNumber}
              totalRepetitions={instance.repetitions}
              setRepetitionNumber={setSelectedRepetitionNumber}
            />
          )}
          <PlaygroundOutputMoveButton
            isDisabled={!hasContent}
            output={outputContent?.output}
            toolCalls={toolCalls as Mutable<typeof toolCalls>}
            instance={instance}
            cleanupOutput={() => {
              cleanup();
              updateInstance({
                instanceId,
                patch: {
                  repetitions: 1,
                  outputByRepetitionNumber: {
                    1: { output: null, spanId: null },
                  },
                },
                dirty: null,
              });
            }}
          />
        </Flex>
      }
      collapsible
    >
      {isRepetitionLoading ? (
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
                output={outputContent?.output ?? null}
                partialToolCalls={toolCalls}
              />
            </MarkdownDisplayProvider>
          </View>
          <Suspense>
            {spanId ? <RunMetadataFooter spanId={spanId} /> : null}
          </Suspense>
        </>
      )}
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
graphql`
  subscription PlaygroundOutputSubscription($input: ChatCompletionInput!) {
    chatCompletion(input: $input) {
      __typename
      repetitionNumber
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
`;
