import { lazy, Suspense } from "react";
import { useLoaderData, useSearchParams } from "react-router";

import { Skeleton } from "@phoenix/components";

import { Playground } from "./Playground";
import type { PlaygroundPageLoaderData } from "./playgroundPageLoader";
import { buildPlaygroundPropsFromLoaderData } from "./playgroundPageLoader";

const EvaluatorPlayground = lazy(
  () => import("./evaluators/EvaluatorPlayground")
);

export function PlaygroundPage() {
  const loaderData = useLoaderData<PlaygroundPageLoaderData>();
  const [searchParams] = useSearchParams();
  const playgroundProps = buildPlaygroundPropsFromLoaderData(
    loaderData ?? null
  );
  if (searchParams.get("mode") === "evaluators") {
    return (
      <Suspense fallback={<Skeleton height="100%" />}>
        <EvaluatorPlayground />
      </Suspense>
    );
  }

  return <Playground {...playgroundProps} />;
}
