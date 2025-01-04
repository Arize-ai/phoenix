import React, { useMemo } from "react";

import { createPlaygroundInstance } from "@phoenix/store";

import { Playground } from "../playground/Playground";

import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptPlaygroundPage() {
  const { prompt } = usePromptIdLoader();

  // create a playground instance with the prompt details configured
  // When the playground component mounts and sees the prompt id in the instance,
  // it will automatically load the latest prompt version into the instance
  const playgroundInstance = useMemo(() => {
    let instance = createPlaygroundInstance();
    instance = {
      ...instance,
      prompt: {
        id: prompt.id,
      },
    };
    return instance;
  }, [prompt]);

  return <Playground instances={[playgroundInstance]} />;
}
