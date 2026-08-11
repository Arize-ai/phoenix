import { graphql, useFragment } from "react-relay";

import { Card, DocumentationHelp } from "@phoenix/components";
import { NewPromptLabelButton } from "@phoenix/components/prompt/NewPromptLabelButton";
import { PromptLabelsTable } from "@phoenix/pages/settings/prompts/PromptLabelsTable";

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
    <Card
      title="Prompt Labels"
      titleExtra={
        <DocumentationHelp topic="promptLabels">
          Create reusable labels for organizing and filtering prompts.
        </DocumentationHelp>
      }
      extra={<NewPromptLabelButton />}
    >
      <PromptLabelsTable query={data} />
    </Card>
  );
}
