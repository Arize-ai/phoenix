import React, { useMemo, useState } from "react";
import { useSubscription } from "react-relay";
import { graphql, GraphQLSubscriptionConfig } from "relay-runtime";

import { Card, Flex, Icon, Icons } from "@arizeai/components";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { ChatMessage, generateMessageId } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  PlaygroundOutputSubscription,
  PlaygroundOutputSubscription$data,
  PlaygroundOutputSubscription$variables,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import { isChatMessages } from "./playgroundUtils";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

function PlaygroundOutputMessage({ message }: { message: ChatMessage }) {
  const styles = useChatMessageStyles(message.role);

  return (
    <Card title={message.role} {...styles} variant="compact">
      {message.content}
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
    >
      {OutputEl}
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
          $model: GenerativeModelInput!
          $invocationParameters: InvocationParameters!
          $tools: [JSON!]
          $apiKey: String
        ) {
          chatCompletion(
            input: {
              messages: $messages
              model: $model
              invocationParameters: $invocationParameters
              tools: $tools
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
  const instances = usePlaygroundContext((state) => state.instances);
  const credentials = useCredentialsContext((state) => state);
  const instance = instances.find(
    (instance) => instance.id === props.playgroundInstanceId
  );
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  if (!instance) {
    throw new Error("No instance found");
  }
  if (typeof instance.activeRunId !== "number") {
    throw new Error("No message found");
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [output, setOutput] = useState<string>("");

  useChatCompletionSubscription({
    params: {
      messages: instance.template.messages.map(toGqlChatCompletionMessage),
      model: {
        providerKey: instance.model.provider,
        name: instance.model.modelName || "",
      },
      invocationParameters: {
        temperature: 0.1, // TODO: add invocation parameters
      },
      tools: instance.tools.map((tool) => tool.definition),
      apiKey: credentials[instance.model.provider],
    },
    runId: instance.activeRunId,
    onNext: (response) => {
      const chatCompletion = response.chatCompletion;
      if (chatCompletion.__typename === "TextChunk") {
        setOutput((acc) => acc + chatCompletion.content);
      }
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
