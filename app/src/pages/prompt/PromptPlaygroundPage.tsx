import React, { useMemo } from "react";

import { createPlaygroundInstance } from "@phoenix/store";

import { Playground } from "../playground/Playground";

import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptPlaygroundPage() {
  const { prompt } = usePromptIdLoader();

  // create a playground instance with the prompt details configured
  // When the playground component mounts and sees the prompt id in the instance,
  // it should automatically load the prompt into the instance
  const playgroundInstance = useMemo(() => {
    const instance = createPlaygroundInstance();
    instance.prompt = {
      id: prompt.id,
    };
    return instance;
  }, [prompt]);

  return <Playground instances={[playgroundInstance]} />;
}
