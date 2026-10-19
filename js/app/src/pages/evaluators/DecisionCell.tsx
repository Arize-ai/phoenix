import { css } from "@emotion/react";
import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Link, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

import type { DecisionCellNameQuery } from "./__generated__/DecisionCellNameQuery.graphql";

export type DecisionCellVersion = {
  id: string;
  decisionId: string;
  sequenceNumber: number;
};

/**
 * Looks up the decision's name. A decision version carries only the id of its
 * decision, so the name is read through `node` (and cached by the store).
 */
function DecisionName({ decisionId }: { decisionId: string }) {
  const data = useLazyLoadQuery<DecisionCellNameQuery>(
    graphql`
      query DecisionCellNameQuery($decisionId: ID!) {
        decision: node(id: $decisionId) {
          __typename
          ... on Decision {
            name
          }
        }
      }
    `,
    { decisionId },
    { fetchPolicy: "store-or-network" }
  );
  const name =
    data.decision.__typename === "Decision" ? data.decision.name : "";
  return <>{name || "Decision"}</>;
}

/**
 * Decision evaluators' counterpart of PromptCell: the decision and the pinned
 * version, linking to the version's page.
 */
export const DecisionCell = ({
  decisionVersion,
  wrapWidth,
  nameMaxWidth = "10rem",
}: {
  decisionVersion?: DecisionCellVersion | null;
  /** See PromptCell: constrains the width and lets the content wrap. */
  wrapWidth?: number;
  nameMaxWidth?: string;
}) => {
  if (!decisionVersion) {
    return null;
  }
  const { decisionId, id, sequenceNumber } = decisionVersion;
  return (
    <Link
      to={`/decisions/${decisionId}/versions/${id}`}
      css={css`
        text-decoration: none;
        ${wrapWidth != null &&
        css`
          max-width: ${wrapWidth}px;
        `}
      `}
    >
      <Flex
        alignItems="center"
        wrap={wrapWidth != null ? "wrap" : undefined}
        gap={wrapWidth != null ? "size-50" : undefined}
      >
        <Truncate maxWidth={wrapWidth != null ? "100%" : nameMaxWidth}>
          <Suspense fallback="Decision">
            <DecisionName decisionId={decisionId} />
          </Suspense>
        </Truncate>
        <Flex alignItems="center">
          <Text color="text-300">{wrapWidth != null ? "@ " : " @ "}</Text>
          <Token size="S" color="var(--global-color-gray-700)">
            {`v${sequenceNumber}`}
          </Token>
        </Flex>
      </Flex>
    </Link>
  );
};
