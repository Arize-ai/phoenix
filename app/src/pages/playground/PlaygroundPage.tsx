import { useMemo } from "react";
import { useLoaderData } from "react-router";

import { Playground } from "./Playground";
import {
  buildPlaygroundPropsFromLoaderData,
  PlaygroundPageLoaderData,
} from "./playgroundPageLoader";

export function PlaygroundPage() {
  const loaderData = useLoaderData<PlaygroundPageLoaderData>();

  const playgroundProps = useMemo(
    () => buildPlaygroundPropsFromLoaderData(loaderData ?? null),
    [loaderData]
  );

  return <Playground {...playgroundProps} />;
}
