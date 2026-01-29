import { Key, Suspense, useCallback, useEffect } from "react";
import { useMutation, useRelayEnvironment } from "react-relay";
import {
  graphql,
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";

import {
  Card,
  Flex,
  Icon,
  Icons,
  ParagraphSkeleton,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
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
  PlaygroundRepetition,
} from "@phoenix/store";
import { isStringKeyedObject } from "@phoenix/typeUtils";
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
  output: PlaygroundRepetition["output"];
  partialToolCalls: readonly PartialOutputToolCall[];
}) {
  if (isChatMessages(output)) {
    return output.map((message, index) => {
      return <PlaygroundOutputMessage key={index} message={message} />;
    });
  }
  if (typeof output === "string" || partialToolCalls.length > 0) {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          content: output ?? undefined,
          role: "ai",
          toolCalls: partialToolCalls,
        }}
      />
    );
  }
  return "click run to see output";
}

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }
  const streaming = usePlaygroundContext((state) => state.streaming);
  const credentials = useCredentialsContext((state) => state);
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  const {
    appendRepetitionOutput,
    setSelectedRepetitionNumber,
    setRepetitionSpanId,
    setRepetitionError,
    setRepetitionStatus,
    setRepetitionToolCalls,
    addRepetitionPartialToolCall,
    clearRepetitions,
    markPlaygroundInstanceComplete,
  } = usePlaygroundContext((state) => ({
    appendRepetitionOutput: state.appendRepetitionOutput,
    setSelectedRepetitionNumber: state.setSelectedRepetitionNumber,
    setRepetitionSpanId: state.setRepetitionSpanId,
    setRepetitionError: state.setRepetitionError,
    setRepetitionStatus: state.setRepetitionStatus,
    setRepetitionToolCalls: state.setRepetitionToolCalls,
    addRepetitionPartialToolCall: state.addRepetitionPartialToolCall,
    clearRepetitions: state.clearRepetitions,
    markPlaygroundInstanceComplete: state.markPlaygroundInstanceComplete,
  }));

  const environment = useRelayEnvironment();
  const playgroundStore = usePlaygroundStore();

  const numInstanceRepetitions = Object.keys(instance.repetitions).length;
  const numRepetitionErrors = Object.values(instance.repetitions).filter(
    (output) => output?.error != null
  ).length;
  const selectedRepetitionNumber = instance.selectedRepetitionNumber;
  const selectedRepetition = instance.repetitions[selectedRepetitionNumber];
  const selectedRepetitionError = selectedRepetition?.error ?? null;
  const selectedRepetitionToolCalls = Object.values(
    selectedRepetition?.toolCalls ?? {}
  );
  const selectedRepetitionSpanId = selectedRepetition?.spanId;
  const selectedRepetitionSuccessfullyCompleted =
    selectedRepetition?.status === "finished" &&
    selectedRepetition?.error == null;

  const [generateChatCompletion] = useMutation<PlaygroundOutputMutationType>(
    PlaygroundOutputMutation
  );

  const runInProgress = instances.some(
    (instance) => instance.activeRunId != null
  );
  const notifyErrorToast = useNotifyError();

  const notifyError = useCallback(
    ({ title, message, ...rest }: Parameters<typeof notifyErrorToast>[0]) => {
      notifyErrorToast({
        title,
        message,
        ...rest,
      });
    },
    [notifyErrorToast]
  );

  const handleChatCompletionSubscriptionPayload = useCallback(
    ({ chatCompletion }: PlaygroundOutputSubscription$data) => {
      if (chatCompletion.__typename === "TextChunk") {
        const content = chatCompletion.content;
        if (content == null || chatCompletion.repetitionNumber == null) {
          return;
        }
        setRepetitionStatus(
          instanceId,
          chatCompletion.repetitionNumber,
          "streamInProgress"
        );
        appendRepetitionOutput(
          instanceId,
          chatCompletion.repetitionNumber,
          content
        );
        return;
      } else if (chatCompletion.__typename === "ToolCallChunk") {
        const chatCompletionId = chatCompletion.id;
        const chatCompletionFunction = chatCompletion.function;
        if (
          chatCompletionFunction == null ||
          chatCompletionId == null ||
          chatCompletion.repetitionNumber == null
        ) {
          return;
        }
        setRepetitionStatus(
          instanceId,
          chatCompletion.repetitionNumber,
          "streamInProgress"
        );
        addRepetitionPartialToolCall(
          instanceId,
          chatCompletion.repetitionNumber,
          {
            id: chatCompletionId,
            function: {
              name: chatCompletionFunction.name,
              arguments: chatCompletionFunction.arguments,
            },
          }
        );
      }
      if (chatCompletion.__typename === "ChatCompletionSubscriptionResult") {
        if (chatCompletion.repetitionNumber == null) {
          return;
        }
        setRepetitionStatus(
          instanceId,
          chatCompletion.repetitionNumber,
          "finished"
        );
        if (chatCompletion.span != null) {
          setRepetitionSpanId(
            instanceId,
            chatCompletion.repetitionNumber,
            chatCompletion.span.id
          );
        }
        return;
      }
      if (chatCompletion.__typename === "ChatCompletionSubscriptionError") {
        if (chatCompletion.repetitionNumber == null) {
          return;
        }
        setRepetitionStatus(
          instanceId,
          chatCompletion.repetitionNumber,
          "finished"
        );
        setRepetitionError(instanceId, chatCompletion.repetitionNumber, {
          title: "Chat completion failed",
          message: chatCompletion.message,
        });
      }
    },
    [
      addRepetitionPartialToolCall,
      instanceId,
      appendRepetitionOutput,
      setRepetitionSpanId,
      setRepetitionStatus,
      setRepetitionError,
    ]
  );

  const handleChatCompletionMutationPayload = useCallback(
    (
      response: PlaygroundOutputMutation$data,
      errors: PayloadError[] | null
    ) => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      if (errors != null && errors.length > 0) {
        notifyError({
          title: "Chat completion failed",
          message: errors[0].message,
        });
        return;
      }
      const instance = playgroundStore
        .getState()
        .instances.find((inst) => inst.id === instanceId);
      if (instance == null) {
        return;
      }
      response.chatCompletion.repetitions.forEach((repetition) => {
        const repetitionNumber = repetition.repetitionNumber;
        setRepetitionStatus(instanceId, repetitionNumber, "finished");
        if (repetition.content != null) {
          appendRepetitionOutput(
            instanceId,
            repetitionNumber,
            repetition.content
          );
        }
        if (repetition.toolCalls.length > 0) {
          setRepetitionToolCalls(instanceId, repetitionNumber, [
            ...repetition.toolCalls,
          ]);
        }
        if (repetition.span != null) {
          setRepetitionSpanId(instanceId, repetitionNumber, repetition.span.id);
        }
        if (repetition.errorMessage != null) {
          setRepetitionError(instanceId, repetitionNumber, {
            title: "Chat completion failed",
            message: repetition.errorMessage,
          });
        }
      });
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      setRepetitionToolCalls,
      playgroundStore,
      props.playgroundInstanceId,
      appendRepetitionOutput,
      setRepetitionSpanId,
      setRepetitionStatus,
      setRepetitionError,
    ]
  );

  // CANCELLATION: When runInProgress becomes false (via cancelPlaygroundInstances),
  // this effect's cleanup function runs, calling subscription.dispose(). This aborts
  // the fetch request, causing the backend to detect disconnect and stop LLM streams.
  // See: src/phoenix/server/api/helpers/cancellation.py for full architecture
  useEffect(() => {
    if (!runInProgress) {
      return;
    }
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
              handleChatCompletionSubscriptionPayload(response);
            }
          },
          onCompleted: () => {
            markPlaygroundInstanceComplete(props.playgroundInstanceId);
          },
          onError: (error) => {
            markPlaygroundInstanceComplete(props.playgroundInstanceId);
            const instance = playgroundStore
              .getState()
              .instances.find((inst) => inst.id === instanceId);
            if (instance != null) {
              Object.keys(instance.repetitions).forEach((repetitionNumber) => {
                setRepetitionStatus(
                  instanceId,
                  parseInt(repetitionNumber),
                  "finished"
                );
              });
            }
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
      onCompleted: handleChatCompletionMutationPayload,
      onError(error) {
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        clearRepetitions(instanceId);
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
    credentials,
    environment,
    generateChatCompletion,
    instanceId,
    clearRepetitions,
    markPlaygroundInstanceComplete,
    notifyError,
    handleChatCompletionMutationPayload,
    handleChatCompletionSubscriptionPayload,
    runInProgress,
    playgroundStore,
    props.playgroundInstanceId,
    setRepetitionStatus,
    streaming,
  ]);

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      extra={
        <Flex direction="row" gap="size-150" alignItems="center">
          {numInstanceRepetitions > 1 && numRepetitionErrors > 0 && (
            <TooltipTrigger>
              <TriggerWrap>
                <Icon svg={<Icons.AlertTriangleOutline />} color="danger" />
              </TriggerWrap>
              <Tooltip>
                <Text>{`${numRepetitionErrors} repetition ${numRepetitionErrors > 1 ? "s" : ""} failed`}</Text>
              </Tooltip>
            </TooltipTrigger>
          )}
          {numInstanceRepetitions > 1 && (
            <ExperimentRepetitionSelector
              repetitionNumber={selectedRepetitionNumber}
              totalRepetitions={numInstanceRepetitions}
              setRepetitionNumber={(n) => {
                let repetitionNumber: number;
                if (typeof n === "function") {
                  repetitionNumber = n(selectedRepetitionNumber);
                } else {
                  repetitionNumber = n;
                }
                setSelectedRepetitionNumber(instanceId, repetitionNumber);
              }}
            />
          )}
          <PlaygroundOutputMoveButton
            isDisabled={!selectedRepetitionSuccessfullyCompleted}
            output={selectedRepetition?.output}
            toolCalls={selectedRepetitionToolCalls}
            instance={instance}
            cleanupOutput={() => {
              clearRepetitions(instanceId);
            }}
          />
        </Flex>
      }
    >
      {(() => {
        switch (true) {
          case selectedRepetition?.status === "pending":
            return (
              <View padding="size-200">
                <ParagraphSkeleton lines={4} />
              </View>
            );
          case selectedRepetitionError != null:
            return (
              <View padding="size-200">
                <PlaygroundErrorWrap>
                  {selectedRepetitionError.message}
                </PlaygroundErrorWrap>
              </View>
            );
          default:
            return (
              <>
                <View padding="size-200">
                  <MarkdownDisplayProvider>
                    <PlaygroundOutputContent
                      output={selectedRepetition?.output ?? null}
                      partialToolCalls={selectedRepetitionToolCalls}
                    />
                  </MarkdownDisplayProvider>
                </View>
                <Suspense>
                  {selectedRepetitionSpanId ? (
                    <RunMetadataFooter spanId={selectedRepetitionSpanId} />
                  ) : null}
                </Suspense>
              </>
            );
        }
      })()}
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
      repetitions {
        repetitionNumber
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
  }
`;
