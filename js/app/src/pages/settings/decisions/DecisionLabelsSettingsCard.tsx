import { graphql, useFragment } from "react-relay";

import { Card } from "@phoenix/components";
import { NewDecisionLabelButton } from "@phoenix/pages/decisions/NewDecisionLabelButton";
import { DecisionLabelsTable } from "@phoenix/pages/settings/decisions/DecisionLabelsTable";

import type { DecisionLabelsSettingsCardFragment$key } from "./__generated__/DecisionLabelsSettingsCardFragment.graphql";

export function DecisionLabelsSettingsCard({
  query,
}: {
  query: DecisionLabelsSettingsCardFragment$key;
}) {
  const data = useFragment<DecisionLabelsSettingsCardFragment$key>(
    graphql`
      fragment DecisionLabelsSettingsCardFragment on Query {
        ...DecisionLabelsTableFragment
      }
    `,
    query
  );

  return (
    <Card title="Decision Labels" extra={<NewDecisionLabelButton />}>
      <DecisionLabelsTable query={data} />
    </Card>
  );
}
