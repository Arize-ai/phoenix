import { LoaderFunctionArgs } from "react-router";

import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";

export const promptPlaygroundLoader = async ({
  params,
}: LoaderFunctionArgs) => {
  const { promptId, versionId } = params;
  if (!promptId) {
    throw new Error("Prompt ID is required");
  }
  const response = await fetchPlaygroundPromptAsInstance({
    promptId,
    promptVersionId: versionId,
  });
  if (!response) {
    throw new Error("Prompt not found");
  }

  return {
    instanceWithPrompt: response.instance,
    templateFormat: response.promptVersion.templateFormat,
    requestedVersion: versionId,
  };
};

export type PromptPlaygroundLoaderData = Awaited<
  ReturnType<typeof promptPlaygroundLoader>
>;
