import { lazy, Suspense } from "react";
import { useLoaderData, useSearchParams } from "react-router";

import { EvaluatorPlaygroundLoading } from "./evaluators/EvaluatorPlaygroundFrame";
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
      <Suspense fallback={<EvaluatorPlaygroundLoading />}>
        <EvaluatorPlayground />
      </Suspense>
    );
  }

  return <Playground {...playgroundProps} />;
}
