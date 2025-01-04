import React from "react";

import {
  PromptQueryReference,
  usePlaygroundPrompt,
  usePlaygroundPromptReference,
} from "@phoenix/pages/playground/usePlaygroundPrompt";

const PlaygroundPromptLoader = ({
  instanceId,
  promptReference,
}: {
  instanceId: number;
  promptReference: PromptQueryReference;
}) => {
  usePlaygroundPrompt(instanceId, promptReference);
  return null;
};

export const PlaygroundPromptFetcher = ({
  instanceId,
}: {
  instanceId: number;
}) => {
  const promptReference = usePlaygroundPromptReference(instanceId);
  // skip loading if the prompt reference is not available, e.g. if there is no prompt associated with the instance
  if (!promptReference) {
    return null;
  }
  return (
    <PlaygroundPromptLoader
      instanceId={instanceId}
      promptReference={promptReference}
    />
  );
};
