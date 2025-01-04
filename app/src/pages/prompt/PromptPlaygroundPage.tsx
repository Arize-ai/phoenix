import React, { useMemo } from "react";
import { useLoaderData } from "react-router";

import { PromptPlaygroundLoaderData } from "@phoenix/pages/prompt/promptPlaygroundLoader";
import { createPlaygroundInstance } from "@phoenix/store";

import { Playground } from "../playground/Playground";

export function PromptPlaygroundPage() {
  const { instanceWithPrompt } = useLoaderData() as PromptPlaygroundLoaderData;

  // create a playground instance with the prompt details configured
  // When the playground component mounts and sees the prompt id in the instance,
  // it will automatically load the latest prompt version into the instance
  const playgroundInstance = useMemo(() => {
    return {
      ...createPlaygroundInstance(),
      ...instanceWithPrompt,
    };
  }, [instanceWithPrompt]);

  return <Playground instances={[playgroundInstance]} />;
}
