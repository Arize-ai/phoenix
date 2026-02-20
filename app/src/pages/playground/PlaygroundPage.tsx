import { useMemo } from "react";
import { useLoaderData } from "react-router";

import { Playground } from "./Playground";
import type { PlaygroundPageLoaderData } from "./playgroundPageLoader";
import { buildPlaygroundPropsFromLoaderData } from "./playgroundPageLoader";

export function PlaygroundPage() {
  const loaderData = useLoaderData<PlaygroundPageLoaderData>();

  const playgroundProps = useMemo(
    () => buildPlaygroundPropsFromLoaderData(loaderData ?? null),
    [loaderData]
  );

  return <Playground {...playgroundProps} />;
}
