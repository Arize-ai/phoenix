import { graphql, useFragment } from "react-relay";
import { Outlet } from "react-router";

import { Flex, View } from "@phoenix/components";

import type { DecisionVersionsPageContent__main$key } from "./__generated__/DecisionVersionsPageContent__main.graphql";
import { DecisionVersionsList } from "./DecisionVersionsList";

/**
 * The Versions tab of a decision: its versions on the left and the selected
 * version on the right.
 */
export function DecisionVersionsPage({
  decision,
  versionId,
}: {
  decision: DecisionVersionsPageContent__main$key;
  versionId?: string;
}) {
  const data = useFragment<DecisionVersionsPageContent__main$key>(
    graphql`
      fragment DecisionVersionsPageContent__main on Decision {
        ...DecisionVersionsList__main
      }
    `,
    decision
  );
  return (
    <View height="100%">
      <Flex direction="row" height="100%">
        <DecisionVersionsList decision={data} activeVersionId={versionId} />
        <Outlet />
      </Flex>
    </View>
  );
}
