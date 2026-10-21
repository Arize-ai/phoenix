import { css } from "@emotion/react";

import { Flex, Link, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { IdTruncate } from "@phoenix/pages/playground/PromptMenu";

export type DecisionCellVersion = {
  id: string;
  decisionId: string;
  /** The decision; select `decision { name }` next to the version. */
  decision?: { name: string } | null;
};

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
  const { decisionId, id, decision } = decisionVersion;
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
          {decision?.name || "Decision"}
        </Truncate>
        <Flex alignItems="center">
          <Text color="text-300">{wrapWidth != null ? "@ " : " @ "}</Text>
          <Token size="S" color="var(--global-color-gray-700)">
            <IdTruncate id={id} />
          </Token>
        </Flex>
      </Flex>
    </Link>
  );
};
