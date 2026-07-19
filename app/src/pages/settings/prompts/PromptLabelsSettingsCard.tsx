import { graphql, useFragment } from "react-relay";

import { Card } from "@phoenix/components";
import { NewPromptLabelButton } from "@phoenix/components/prompt/NewPromptLabelButton";
import { PHOENIX_DOCUMENTATION_LINKS } from "@phoenix/constants";
import { PromptLabelsTable } from "@phoenix/pages/settings/prompts/PromptLabelsTable";

import { SettingsDocumentationHelp } from "../SettingsDocumentationHelp";
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
        <SettingsDocumentationHelp
          href={PHOENIX_DOCUMENTATION_LINKS.promptLabels}
          topic="prompt labels"
        >
          Create reusable labels for organizing and filtering prompts.
        </SettingsDocumentationHelp>
      }
      extra={<NewPromptLabelButton />}
    >
      <PromptLabelsTable query={data} />
    </Card>
  );
}
