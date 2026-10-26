import { graphql, useFragment } from "react-relay";

import { Alert, Flex } from "@phoenix/components";
import {
  PromptDetailsAside,
  PromptDetailsMainColumn,
} from "@phoenix/pages/prompt/PromptDetailsAside";

import type { DecisionIndexPage__aside$key } from "./__generated__/DecisionIndexPage__aside.graphql";
import type { DecisionIndexPage__main$key } from "./__generated__/DecisionIndexPage__main.graphql";
import { DecisionCodeExportCard } from "./DecisionCodeExportCard";
import { DecisionDefinitionCard } from "./DecisionDefinitionCard";
import { DecisionLabelConfigButton } from "./DecisionLabelConfigButton";
import { DecisionLabels } from "./DecisionLabels";
import { DecisionLatestVersionsList } from "./DecisionLatestVersionsList";
import { DecisionModelConfigurationCard } from "./DecisionModelConfigurationCard";
import { EditDecisionButton } from "./EditDecisionButton";

/**
 * The first tab of a decision's detail page: the latest version's definition
 * and model, and the decision's description, labels, metadata, and history.
 */
export function DecisionIndexPage({
  decision,
}: {
  decision: DecisionIndexPage__main$key;
}) {
  const data = useFragment<DecisionIndexPage__main$key>(
    graphql`
      fragment DecisionIndexPage__main on Decision {
        latestVersion: version {
          ...DecisionDefinitionCard_version
          ...DecisionModelConfigurationCard_version
          ...DecisionCodeExportCard_version
        }
        ...DecisionIndexPage__aside
      }
    `,
    decision
  );
  const latestVersion = data.latestVersion;
  return (
    <Flex direction="row" height="100%">
      <PromptDetailsMainColumn>
        {latestVersion ? (
          <>
            <DecisionDefinitionCard decisionVersion={latestVersion} />
            <DecisionModelConfigurationCard decisionVersion={latestVersion} />
            <DecisionCodeExportCard decisionVersion={latestVersion} />
          </>
        ) : (
          <Alert variant="warning">This decision has no versions.</Alert>
        )}
      </PromptDetailsMainColumn>
      <DecisionIndexPageAside decision={data} />
    </Flex>
  );
}

function DecisionIndexPageAside({
  decision,
}: {
  decision: DecisionIndexPage__aside$key;
}) {
  const data = useFragment<DecisionIndexPage__aside$key>(
    graphql`
      fragment DecisionIndexPage__aside on Decision {
        id
        description
        metadata
        ...DecisionLatestVersionsListFragment
        ...EditDecisionButton_data
        ...DecisionLabels
      }
    `,
    decision
  );
  return (
    <PromptDetailsAside
      description={data.description}
      metadata={data.metadata}
      editButton={<EditDecisionButton decision={data} />}
      labelConfigButton={<DecisionLabelConfigButton decisionId={data.id} />}
      labels={<DecisionLabels decision={data} />}
      latestVersions={<DecisionLatestVersionsList decision={data} />}
    />
  );
}
