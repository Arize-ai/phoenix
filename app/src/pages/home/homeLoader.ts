import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { homeLoaderQuery } from "./__generated__/homeLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the home page
 * makes a determination about the available functionality
 */
export async function homeLoader(_args: LoaderFunctionArgs) {
  const data = await fetchQuery<homeLoaderQuery>(
    RelayEnvironment,
    graphql`
      query homeLoaderQuery {
        functionality {
          modelInferences
        }
      }
    `,
    {}
  ).toPromise();

  if (data?.functionality.modelInferences) {
    return redirect("/model");
  } else {
    return redirect("/projects");
  }
}
