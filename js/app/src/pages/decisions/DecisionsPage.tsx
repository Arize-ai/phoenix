import { graphql, useLazyLoadQuery } from "react-relay";

import type { DecisionsPageQuery } from "./__generated__/DecisionsPageQuery.graphql";
import { DecisionsFilterProvider } from "./DecisionsFilterProvider";
import { DecisionsTable } from "./DecisionsTable";
import { DecisionsTableProvider } from "./DecisionsTableContext";

export function DecisionsPage() {
  const data = useLazyLoadQuery<DecisionsPageQuery>(
    graphql`
      query DecisionsPageQuery {
        ...DecisionsTable_decisions
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );
  return (
    <DecisionsFilterProvider>
      <DecisionsTableProvider>
        <DecisionsTable query={data} />
      </DecisionsTableProvider>
    </DecisionsFilterProvider>
  );
}
