import { css } from "@emotion/react";

import { Flex, Link, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

/**
 * The `name @ tag` link an evaluator shows for what it runs: a prompt for LLM
 * evaluators, a decision for decision evaluators. Both share this component so
 * the two read the same way wherever they appear. Without a tag, the
 * evaluator runs the latest version, and the token says `latest`.
 */
export const VersionedNameLink = ({
  to,
  name,
  versionTag,
  wrapWidth,
  nameMaxWidth = "10rem",
}: {
  to: string;
  name: string;
  /** The tag the evaluator is pinned to; omit when it runs the latest version. */
  versionTag?: string | null;
  /**
   * When set, constrains the component to a max-width (in pixels) and allows
   * the content to wrap onto two lines if needed. When undefined, the component
   * displays inline without wrapping.
   */
  wrapWidth?: number;
  /**
   * How much width the name may take before truncating, when `wrapWidth` is
   * not set. The default suits a table cell; a caller with room to spare -- a
   * card header, say -- can raise it so the name reads in full.
   */
  nameMaxWidth?: string;
}) => {
  return (
    <Link
      to={to}
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
        <Truncate
          maxWidth={wrapWidth != null ? "100%" : nameMaxWidth}
          title={name}
        >
          {name}
        </Truncate>
        <Flex alignItems="center">
          <Text color="text-300">{wrapWidth != null ? "@ " : " @ "}</Text>
          <Token size="S" color="var(--global-color-gray-700)">
            {versionTag ? (
              <Truncate maxWidth="10rem" title={versionTag}>
                {versionTag}
              </Truncate>
            ) : (
              "latest"
            )}
          </Token>
        </Flex>
      </Flex>
    </Link>
  );
};
