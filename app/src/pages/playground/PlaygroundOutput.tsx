import React, { useMemo, useState } from "react";
import { useSubscription } from "react-relay";
import { graphql, GraphQLSubscriptionConfig } from "relay-runtime";

import { Card, Flex, Icon, Icons } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ChatMessage, ChatMessageRole } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  PlaygroundOutputSubscription,
  PlaygroundOutputSubscription$data,
  PlaygroundOutputSubscription$variables,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instance = usePlaygroundContext((state) => state.instances[instanceId]);
  if (!instance) {
    return null;
  }
  const runId = instance.activeRunId;
  const hasRunId = runId !== null;
  return (
    <Card title="Output" collapsible variant="compact">
      {hasRunId ? (
        <PlaygroundOutputText key={runId} playgroundInstanceId={instanceId} />
      ) : (
        "click run to see output"
      )}
    </Card>
  );
}

function useChatCompletionSubscription({
  params,
  runId,
  onNext,
  onCompleted,
}: {
  params: PlaygroundOutputSubscription$variables;
  runId: number;
  onNext: (response: PlaygroundOutputSubscription$data) => void;
  onCompleted: () => void;
}) {
  const config = useMemo<
    GraphQLSubscriptionConfig<PlaygroundOutputSubscription>
  >(
    () => ({
      subscription: graphql`
        subscription PlaygroundOutputSubscription(
          $messages: [ChatCompletionMessageInput!]!
        ) {
          chatCompletion(input: { messages: $messages })
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
  const instance = usePlaygroundContext(
    (state) => state.instances[props.playgroundInstanceId]
  );
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const [output, setOutput] = useState<string>("");
  if (!instance) {
    throw new Error("No instance found");
  }
  if (typeof instance.activeRunId !== "number") {
    throw new Error("No message found");
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  useChatCompletionSubscription({
    params: {
      messages: instance.template.messages.map(toGqlChatCompletionMessage),
    },
    runId: instance.activeRunId,
    onNext: (response) => {
      setOutput((acc) => acc + response.chatCompletion);
    },
    onCompleted: () => {
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
    },
  });

  if (!output) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.LoadingOutline />} />
        Running...
      </Flex>
    );
  }
  return <span>{output}</span>;
}
