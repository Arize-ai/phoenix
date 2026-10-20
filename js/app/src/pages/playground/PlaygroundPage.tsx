import { Suspense, useMemo } from "react";
import { useLoaderData, useSearchParams } from "react-router";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getPlaygroundMode } from "@phoenix/store/playground";

import { Playground } from "./Playground";
import type { PlaygroundPageLoaderData } from "./playgroundPageLoader";
import { buildPlaygroundPropsFromLoaderData } from "./playgroundPageLoader";
import { PlaygroundPageSkeleton } from "./PlaygroundPageSkeleton";
import { getPlaygroundPanelIds } from "./playgroundPanelLayout";
import { resolvePlaygroundDatasetId } from "./playgroundURLSearchParamsUtils";

export function PlaygroundPage() {
  const loaderData = useLoaderData<PlaygroundPageLoaderData>();
  const [searchParams] = useSearchParams();

  const playgroundProps = buildPlaygroundPropsFromLoaderData(
    loaderData ?? null
  );

  const isDatasetMode =
    resolvePlaygroundDatasetId({
      searchParams,
      storeDatasetId: playgroundProps.datasetId ?? null,
    }) != null;
  const templateFormat =
    playgroundProps.templateFormat ?? TemplateFormats.Mustache;
  const mode = getPlaygroundMode(playgroundProps.instances ?? []);
  const panelIds = useMemo(
    () => getPlaygroundPanelIds({ isDatasetMode, templateFormat, mode }),
    [isDatasetMode, templateFormat, mode]
  );

  return (
    <Suspense fallback={<PlaygroundPageSkeleton panelIds={panelIds} />}>
      <Playground {...playgroundProps} />
    </Suspense>
  );
}
