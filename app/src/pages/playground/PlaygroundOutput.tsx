import React, { useMemo, useState } from "react";
import { useSubscription } from "react-relay";
import { graphql, GraphQLSubscriptionConfig } from "relay-runtime";

import { Card } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  PlaygroundOutputSubscription,
  PlaygroundOutputSubscription$data,
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
        <PlaygroundOutputText key={runId} />
      ) : (
        "click run to see output"
      )}
    </Card>
  );
}

function useChatCompletionSubscription({
  message,
  runId,
  onNext,
}: {
  message: string;
  runId: number;
  onNext: (response: PlaygroundOutputSubscription$data) => void;
}) {
  const config = useMemo<
    GraphQLSubscriptionConfig<PlaygroundOutputSubscription>
  >(
    () => ({
      subscription: graphql`
        subscription PlaygroundOutputSubscription($message: String!) {
          chatCompletion(input: { message: $message })
        }
      `,
      variables: { message },
      onNext: (response) => {
        if (response) {
          onNext(response);
        }
      },
      onCompleted: () => {
        // TODO: clear the run
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId]
  );
  return useSubscription(config);
}

function PlaygroundOutputText() {
  const instance = usePlaygroundContext((state) => state.instances[0]);
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

  const message = instance.template.messages.reduce((acc, message) => {
    return acc + message.content;
  }, "");

  useChatCompletionSubscription({
    message: message,
    runId: instance.activeRunId,
    onNext: (response) => {
      setOutput((acc) => acc + response.chatCompletion);
    },
  });
  return <span>{output}</span>;
}
