import { LoaderFunctionArgs } from "react-router-dom";

import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";

export const promptPlaygroundLoader = async ({
  params,
}: LoaderFunctionArgs) => {
  const { promptId } = params;
  if (!promptId) {
    throw new Error("Prompt ID is required");
  }
  const instanceWithPrompt = await fetchPlaygroundPromptAsInstance(promptId);
  return { instanceWithPrompt };
};

export type PromptPlaygroundLoaderData = Awaited<
  ReturnType<typeof promptPlaygroundLoader>
>;
