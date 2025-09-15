import { graphql, useLazyLoadQuery } from "react-relay";

import { SettingsPromptsPageQuery } from "@phoenix/pages/settings/prompts/__generated__/SettingsPromptsPageQuery.graphql";

import { PromptLabelsSettingsCard } from "./PromptLabelsSettingsCard";

export function SettingsPromptsPage() {
  const query = useLazyLoadQuery<SettingsPromptsPageQuery>(
    graphql`
      query SettingsPromptsPageQuery {
        ...PromptLabelsSettingsCardFragment
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <main>
      <PromptLabelsSettingsCard query={query} />
    </main>
  );
}
