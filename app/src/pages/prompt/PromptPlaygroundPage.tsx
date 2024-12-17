import React, { useMemo } from "react";
import { useLoaderData } from "react-router";

import { createPlaygroundInstance } from "@phoenix/store";

import { Playground } from "../playground/Playground";

import { promptLoaderQuery$data } from "./__generated__/promptLoaderQuery.graphql";

export function PromptPlaygroundPage() {
  const { prompt } = useLoaderData() as promptLoaderQuery$data;

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
