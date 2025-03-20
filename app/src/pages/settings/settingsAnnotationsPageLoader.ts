import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsAnnotationsPageLoaderQuery } from "./__generated__/settingsAnnotationsPageLoaderQuery.graphql";

export async function settingsAnnotationsPageLoader() {
  return await fetchQuery<settingsAnnotationsPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsAnnotationsPageLoaderQuery {
        ...SettingsAnnotationsPageFragment
      }
    `,
    {}
  ).toPromise();
}

export type SettingsAnnotationsPageLoaderData = NonNullable<
  Awaited<ReturnType<typeof settingsAnnotationsPageLoader>>
>;
