import type { LoaderFunctionArgs } from "react-router";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import type {
  EvaluatorTaskParam,
  PromptParam,
} from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import {
  parseEvaluatorTaskParams,
  parsePromptParams,
} from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type {
  PlaygroundInstance,
  PlaygroundProps,
  PlaygroundStateByDatasetId,
} from "@phoenix/store";
import {
  createEvaluatorTaskInstance,
  createNormalizedPlaygroundInstance,
} from "@phoenix/store";

import { fetchExperimentPlaygroundProps } from "./experimentRehydration";
import { fetchPlaygroundEvaluatorAsInstance } from "./fetchPlaygroundEvaluator";

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
      source: "evaluator";
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
    loaderData.source === "experiment" ||
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
 * The fetches the loader makes. The route uses the real ones; tests hand in
 * stand-ins, so the loader's ordering and fallback rules are checked without
 * the network.
 */
export type PlaygroundPageLoaderFetchers = {
  fetchPromptAsInstance: typeof fetchPlaygroundPromptAsInstance;
  fetchEvaluatorAsInstance: typeof fetchPlaygroundEvaluatorAsInstance;
  fetchExperimentProps: typeof fetchExperimentPlaygroundProps;
};

const ROUTE_FETCHERS: PlaygroundPageLoaderFetchers = {
  fetchPromptAsInstance: fetchPlaygroundPromptAsInstance,
  fetchEvaluatorAsInstance: fetchPlaygroundEvaluatorAsInstance,
  fetchExperimentProps: fetchExperimentPlaygroundProps,
};

/**
 * Loads the evaluator tasks the URL names, one instance per position. A
 * task that fails to load (deleted, built-in) is skipped; a page with no
 * loadable task opens on a fresh LLM evaluator draft so the kind the URL
 * asked for is kept.
 */
async function loadEvaluatorTaskInstances(
  evaluators: EvaluatorTaskParam[],
  fetchEvaluatorAsInstance: PlaygroundPageLoaderFetchers["fetchEvaluatorAsInstance"]
): Promise<Extract<PlaygroundPageLoaderData, { source: "evaluator" }>> {
  const fetches = evaluators.map((param) => {
    // A binding names its evaluator too, so the binding wins: its mapping is
    // what the task should carry.
    const source = param.projectEvaluatorId
      ? {
          type: "projectEvaluator" as const,
          projectEvaluatorId: param.projectEvaluatorId,
        }
      : param.datasetEvaluatorId
        ? {
            type: "datasetEvaluator" as const,
            datasetEvaluatorId: param.datasetEvaluatorId,
          }
        : param.evaluatorId
          ? { type: "evaluator" as const, evaluatorId: param.evaluatorId }
          : null;

    return source
      ? fetchEvaluatorAsInstance(source).catch(() => null)
      : Promise.resolve(null);
  });

  const loaded = (await Promise.all(fetches)).filter(
    (result) => result != null
  );

  if (loaded.length === 0) {
    return {
      source: "evaluator",
      instances: [createEvaluatorTaskInstance({ kind: "LLM" })],
      templateFormat: TemplateFormats.Mustache,
    };
  }

  return {
    source: "evaluator",
    instances: loaded.map((result) => result.instance),
    // The page has one format; the first judge prompt's is as good a pick
    // as any, and code evaluators have no say.
    templateFormat:
      loaded.find((result) => result.templateFormat != null)?.templateFormat ??
      TemplateFormats.Mustache,
  };
}

/**
 * Builds the loader for the /playground route over the given fetches.
 *
 * Supports three sources:
 * - experimentId URL param → load from experiment task config
 * - evaluator{n}/datasetEvaluator{n} URL params, or taskKind=evaluator → evaluator tasks
 * - promptId/promptVersionId/promptTagName URL params → load from prompt version
 *
 * Returns `null` when no params are present (default playground).
 */
export function createPlaygroundPageLoader(
  fetchers: PlaygroundPageLoaderFetchers = ROUTE_FETCHERS
) {
  return async ({
    request,
  }: LoaderFunctionArgs): Promise<PlaygroundPageLoaderData> => {
    const url = new URL(request.url);

    // Check for experiment rehydration first
    const experimentId = url.searchParams.get("experimentId");

    if (experimentId) {
      const result = await fetchers.fetchExperimentProps(experimentId);

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

    const evaluatorTasks = parseEvaluatorTaskParams(url.searchParams);

    if (evaluatorTasks.isEvaluatorKind) {
      return loadEvaluatorTaskInstances(
        evaluatorTasks.evaluators,
        fetchers.fetchEvaluatorAsInstance
      );
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
          fetchers
            .fetchPromptAsInstance({ promptId, promptVersionId, tagName })
            .catch(() => null) // Skip prompts that fail to load (e.g. deleted)
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
        // SAFETY: Relay widens the schema's TemplateFormat enum with
        // "%future added value"; a saved prompt version always carries a
        // known format.
        templateFormat ??= result.promptVersion
          .templateFormat as TemplateFormat;
      }
    }

    if (instances.length === 0 || templateFormat === null) {
      return null;
    }

    return { source: "prompt", promptParams, instances, templateFormat };
  };
}

/** The /playground route's loader, over the real fetches. */
export const playgroundPageLoader = createPlaygroundPageLoader();
