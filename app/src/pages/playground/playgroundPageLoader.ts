import { LoaderFunctionArgs } from "react-router";

import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import {
  createNormalizedPlaygroundInstance,
  PlaygroundInstance,
  PlaygroundProps,
} from "@phoenix/store";

/**
 * A single prompt selection parsed from URL search params.
 */
export type PromptParam = {
  promptId: string;
  promptVersionId: string | null;
  tagName: string | null;
};

/**
 * The data returned by the playground page loader.
 */
export type PlaygroundPageLoaderData = {
  promptParams: PromptParam[];
  instances: Awaited<
    ReturnType<typeof fetchPlaygroundPromptAsInstance>
  > extends infer R
    ? NonNullable<R>["instance"][]
    : never;
  templateFormat: TemplateFormat;
} | null;

/**
 * Parses prompt-related search params from a URLSearchParams instance.
 * The three param arrays (`promptId`, `promptVersionId`, `promptTagName`)
 * are zipped by position into {@link PromptParam} tuples.
 *
 * Returns an empty array if no `promptId` params are present.
 */
export function parsePromptParams(
  searchParams: URLSearchParams
): PromptParam[] {
  const promptIds = searchParams.getAll("promptId");
  if (promptIds.length === 0) {
    return [];
  }

  const promptVersionIds = searchParams.getAll("promptVersionId");
  const promptTagNames = searchParams.getAll("promptTagName");

  return promptIds.map((promptId, index) => ({
    promptId,
    promptVersionId: promptVersionIds[index] || null,
    tagName: promptTagNames[index] || null,
  }));
}

/**
 * Writes an array of {@link PromptParam} into a URLSearchParams instance,
 * replacing any existing prompt-related params.
 *
 * Returns `true` if the params actually changed, `false` if they were
 * already in sync.
 */
export function writePromptParams(
  searchParams: URLSearchParams,
  prompts: PromptParam[]
): boolean {
  const currentIds = searchParams.getAll("promptId");
  const currentVersionIds = searchParams.getAll("promptVersionId");
  const currentTagNames = searchParams.getAll("promptTagName");

  const newIds = prompts.map((prompt) => prompt.promptId);
  const newVersionIds = prompts.map((prompt) => prompt.promptVersionId ?? "");
  const newTagNames = prompts.map((prompt) => prompt.tagName ?? "");

  const idsMatch =
    currentIds.length === newIds.length &&
    currentIds.every((id, index) => id === newIds[index]);
  const versionIdsMatch =
    currentVersionIds.length === newVersionIds.length &&
    currentVersionIds.every((id, index) => id === newVersionIds[index]);
  const tagNamesMatch =
    currentTagNames.length === newTagNames.length &&
    currentTagNames.every((name, index) => name === newTagNames[index]);

  if (idsMatch && versionIdsMatch && tagNamesMatch) {
    return false;
  }

  searchParams.delete("promptId");
  searchParams.delete("promptVersionId");
  searchParams.delete("promptTagName");

  for (const prompt of prompts) {
    searchParams.append("promptId", prompt.promptId);
    searchParams.append("promptVersionId", prompt.promptVersionId ?? "");
    searchParams.append("promptTagName", prompt.tagName ?? "");
  }

  return true;
}

/**
 * Builds playground instances from loader data by merging each loaded
 * instance (which lacks an `id`) with a fresh default instance that
 * provides one.
 *
 * Returns `undefined` when there is no loader data so that `Playground`
 * falls through to its default behavior.
 */
export function buildPlaygroundInstancesFromLoaderData(
  loaderData: PlaygroundPageLoaderData
): PlaygroundInstance[] | undefined {
  if (!loaderData || loaderData.instances.length === 0) {
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
): Partial<PlaygroundProps> {
  const instances = buildPlaygroundInstancesFromLoaderData(loaderData);
  if (!instances || !loaderData) {
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
 * Reads promptId, promptVersionId, and promptTagName from URL search params
 * and fetches the corresponding prompt instances so they are available before
 * the page renders.
 *
 * Returns `null` when no prompt params are present (the default playground
 * with no prompts loaded).
 */
export const playgroundPageLoader = async ({
  request,
}: LoaderFunctionArgs): Promise<PlaygroundPageLoaderData> => {
  const url = new URL(request.url);
  const promptParams = parsePromptParams(url.searchParams);

  if (promptParams.length === 0) {
    return null;
  }

  const results = await Promise.all(
    promptParams.map(async ({ promptId, promptVersionId, tagName }) => {
      try {
        return await fetchPlaygroundPromptAsInstance({
          promptId,
          promptVersionId,
          tagName,
        });
      } catch {
        // Skip prompts that fail to load (e.g. deleted prompts)
        return null;
      }
    })
  );

  const validResults = results.filter(
    (result): result is NonNullable<typeof result> => result != null
  );

  if (validResults.length === 0) {
    return null;
  }

  return {
    promptParams,
    instances: validResults.map((result) => result.instance),
    templateFormat: validResults[0].promptVersion
      .templateFormat as TemplateFormat,
  };
};
