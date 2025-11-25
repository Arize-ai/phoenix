import { useMatches, useRouteLoaderData } from "react-router";

import { PromptLoaderData } from "./promptLoader";

/**
 * Returns the loader data for the prompt/:promptId route.
 *
 * This is useful for child routes of prompt/:promptId to access the prompt data,
 * without having to pass it down as a prop or duplicate the loader calls.
 */
export const usePromptIdLoader = () => {
  const matches = useMatches();

  // find the first match whose pathname looks like /prompts/:promptId
  const loader = matches.find(
    (match) => match.pathname.split("/prompts/").length === 2
  );

  if (!loader) {
    throw new Error(
      "usePromptIdLoader must be used within a /prompts/:promptId route"
    );
  }

  return useRouteLoaderData(loader.id) as PromptLoaderData;
};
