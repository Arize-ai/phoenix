import { graphql, useFragment } from "react-relay";

import { Card } from "@phoenix/components";
import { NewPromptLabelButton } from "@phoenix/features/prompts-settings/components/prompt/NewPromptLabelButton";
import { PromptLabelsTable } from "@phoenix/features/prompts-settings/pages/settings/prompts/PromptLabelsTable";

import type { PromptLabelsSettingsCardFragment$key } from "./__generated__/PromptLabelsSettingsCardFragment.graphql";

export function PromptLabelsSettingsCard({
  query,
}: {
  query: PromptLabelsSettingsCardFragment$key;
}) {
  const data = useFragment<PromptLabelsSettingsCardFragment$key>(
    graphql`
      fragment PromptLabelsSettingsCardFragment on Query {
        ...PromptLabelsTableFragment
      }
    `,
    query
  );

  return (
    <Card title="Prompt Labels" extra={<NewPromptLabelButton />}>
      <PromptLabelsTable query={data} />
    </Card>
  );
}
