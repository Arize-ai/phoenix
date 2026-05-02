import type { LoaderFunctionArgs } from "react-router";

import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import type { PromptParam } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import { parsePromptParams } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type {
  PlaygroundInstance,
  PlaygroundProps,
  PlaygroundStateByDatasetId,
} from "@phoenix/store";
import { createNormalizedPlaygroundInstance } from "@phoenix/store";

import { fetchExperimentPlaygroundProps } from "./experimentRehydration";

/**
 * A playground instance as returned by the fetch layer, before a
 * numeric `id` is assigned by {@link createNormalizedPlaygroundInstance}.
 */
type PlaygroundInstanceWithoutId = Omit<PlaygroundInstance, "id">;

/**
 * The data returned by the playground page loader.
 * `null` when no params are present in the URL.
 */
export type PlaygroundPageLoaderData =
  | {
      source: "prompt";
      promptParams: PromptParam[];
      instances: PlaygroundInstanceWithoutId[];
      templateFormat: TemplateFormat;
    }
  | {
      source: "experiment";
      playgroundProps: Partial<PlaygroundProps>;
      datasetId: string | null;
      stateByDatasetId: PlaygroundStateByDatasetId;
      selectedDatasetEvaluatorIds: string[];
    }
  | null;

/**
 * Produces a stable cache key for a prompt param triple.
 * Uses a null-byte separator to avoid collisions between field values.
 */
function promptParamKey(
  promptId: string,
  promptVersionId: string | null,
  tagName: string | null
): string {
  return `${promptId}\0${promptVersionId ?? ""}\0${tagName ?? ""}`;
}

/**
 * Builds playground instances from loader data by merging each loaded
 * instance (which lacks an `id`) with a fresh default instance that
 * provides one.
 *
 * Returns `undefined` when there is no loader data so that `Playground`
 * falls through to its default behavior.
 */
function buildPlaygroundInstancesFromLoaderData(
  loaderData: PlaygroundPageLoaderData
): PlaygroundInstance[] | undefined {
  if (
    !loaderData ||
    loaderData.source !== "prompt" ||
    loaderData.instances.length === 0
  ) {
    return undefined;
  }
  return loaderData.instances.map((instanceWithPrompt) => {
    const { instance: defaultInstance } = createNormalizedPlaygroundInstance();
    return {
      ...defaultInstance,
      ...instanceWithPrompt,
      // Prefer the prompt's template over the default template
      template: instanceWithPrompt.template,
    } satisfies PlaygroundInstance;
  });
}

/**
 * Builds the props to forward to `<Playground>` from loader data.
 * Returns an empty object when there are no prompts so that the
 * defaults inside `Playground` / `PlaygroundProvider` are preserved.
 */
export function buildPlaygroundPropsFromLoaderData(
  loaderData: PlaygroundPageLoaderData
): Partial<PlaygroundProps> & {
  datasetId?: string | null;
  stateByDatasetId?: PlaygroundStateByDatasetId;
  selectedDatasetEvaluatorIds?: string[];
} {
  if (!loaderData) {
    return {};
  }

  if (loaderData.source === "experiment") {
    return {
      ...loaderData.playgroundProps,
      datasetId: loaderData.datasetId,
      stateByDatasetId: loaderData.stateByDatasetId,
      selectedDatasetEvaluatorIds: loaderData.selectedDatasetEvaluatorIds,
    };
  }

  const instances = buildPlaygroundInstancesFromLoaderData(loaderData);
  if (!instances) {
    return {};
  }
  return {
    instances,
    templateFormat: loaderData.templateFormat,
  };
}

/**
 * Loader for the /playground route.
 *
 * Supports two sources:
 * - promptId/promptVersionId/promptTagName URL params → load from prompt version
 * - experimentId URL param → load from experiment task config
 *
 * Returns `null` when no params are present (default playground).
 */
export const playgroundPageLoader = async ({
  request,
}: LoaderFunctionArgs): Promise<PlaygroundPageLoaderData> => {
  const url = new URL(request.url);

  // Check for experiment rehydration first
  const experimentId = url.searchParams.get("experimentId");
  if (experimentId) {
    const result = await fetchExperimentPlaygroundProps(experimentId);
    if (result) {
      return {
        source: "experiment",
        playgroundProps: result.playgroundProps,
        datasetId: result.datasetId,
        stateByDatasetId: result.stateByDatasetId,
        selectedDatasetEvaluatorIds: result.selectedDatasetEvaluatorIds,
      };
    }
    return null;
  }

  // Fall back to prompt params
  const promptParams = parsePromptParams(url.searchParams);

  if (!promptParams.length) {
    return null;
  }

  // De-duplicate identical prompt params so we only make one network
  // request per unique (promptId, promptVersionId, tagName) triple.
  const fetchCache = new Map<
    string,
    Promise<{
      instance: PlaygroundInstanceWithoutId;
      promptVersion: { templateFormat: string };
    } | null>
  >();

  for (const { promptId, promptVersionId, tagName } of promptParams) {
    const key = promptParamKey(promptId, promptVersionId, tagName);
    if (!fetchCache.has(key)) {
      fetchCache.set(
        key,
        fetchPlaygroundPromptAsInstance({
          promptId,
          promptVersionId,
          tagName,
        }).catch(() => null) // Skip prompts that fail to load (e.g. deleted)
      );
    }
  }

  // Wait for all unique fetches, then map each param to its result in
  // the original order so that instance positions match the URL params.
  await Promise.all(fetchCache.values());

  const instances: PlaygroundInstanceWithoutId[] = [];
  let templateFormat: TemplateFormat | null = null;

  for (const { promptId, promptVersionId, tagName } of promptParams) {
    const key = promptParamKey(promptId, promptVersionId, tagName);
    const result = await fetchCache.get(key);
    if (result) {
      instances.push(result.instance);
      templateFormat ??= result.promptVersion.templateFormat as TemplateFormat;
    }
  }

  if (instances.length === 0 || templateFormat === null) {
    return null;
  }

  return { source: "prompt", promptParams, instances, templateFormat };
};
