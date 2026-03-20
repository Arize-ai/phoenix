import type { Key } from "react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRelayEnvironment } from "react-relay";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { graphql, requestSubscription } from "relay-runtime";

import {
  Alert,
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
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import type { ChatMessage, PlaygroundRepetition } from "@phoenix/store";
import { generateMessageId } from "@phoenix/store";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelaySubscriptionError } from "@phoenix/utils/errorUtils";

import { ExperimentRepetitionSelector } from "../experiment/ExperimentRepetitionSelector";
import type {
  PlaygroundOutputSubscription as PlaygroundOutputSubscriptionType,
  PlaygroundOutputSubscription$data,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import PlaygroundOutputSubscription from "./__generated__/PlaygroundOutputSubscription.graphql";
import { PlaygroundErrorWrap } from "./PlaygroundErrorWrap";
import { PlaygroundOutputMoveButton } from "./PlaygroundOutputMoveButton";
import type { PartialOutputToolCall } from "./PlaygroundToolCall";
import { PlaygroundToolCall } from "./PlaygroundToolCall";
import { getChatCompletionInput, isChatMessages } from "./playgroundUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import type { PlaygroundInstanceProps } from "./types";

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
    addRepetitionPartialToolCall,
    clearRepetitions,
    markPlaygroundInstanceComplete,
  } = usePlaygroundContext((state) => ({
    appendRepetitionOutput: state.appendRepetitionOutput,
    setSelectedRepetitionNumber: state.setSelectedRepetitionNumber,
    setRepetitionSpanId: state.setRepetitionSpanId,
    setRepetitionError: state.setRepetitionError,
    setRepetitionStatus: state.setRepetitionStatus,
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

  const runInProgress = instances.some(
    (instance) => instance.activeRunId != null
  );
  const [apiError, setApiError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!runInProgress) {
      return;
    }
    setApiError(null);
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
            handleChatCompletionSubscriptionPayload(response);
          }
        },
        onCompleted: () => {
          markPlaygroundInstanceComplete(props.playgroundInstanceId);
        },
        onError: (error) => {
          markPlaygroundInstanceComplete(props.playgroundInstanceId);
          clearRepetitions(instanceId);
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
            setApiError(errorMessages.join("\n"));
          } else {
            setApiError(error.message);
          }
        },
      };
    const subscription = requestSubscription(environment, config);
    return subscription.dispose;
  }, [
    credentials,
    environment,
    instanceId,
    markPlaygroundInstanceComplete,
    handleChatCompletionSubscriptionPayload,
    runInProgress,
    playgroundStore,
    props.playgroundInstanceId,
    setRepetitionStatus,
    clearRepetitions,
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
                {apiError && (
                  <View padding="size-200">
                    <Alert
                      variant="danger"
                      dismissable
                      onDismissClick={() => setApiError(null)}
                    >
                      {apiError}
                    </Alert>
                  </View>
                )}
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
