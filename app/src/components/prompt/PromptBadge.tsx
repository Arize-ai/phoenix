import { css } from "@emotion/react";

import { Text, Token, TokenProps } from "@phoenix/components";

type PromptBadgeProps = {
  /**
   * Size of the badge
   * @default "M"
   */
  size?: TokenProps["size"];
  /**
   * Maximum width for the badge
   */
  maxWidth?: TokenProps["maxWidth"];
} & (
  | {
      /**
       * Tag name to display with semantic colors
       */
      tag: string;
      versionId?: never;
      isLatest?: never;
    }
  | {
      /**
       * Version ID to display (truncated)
       */
      versionId: string;
      /**
       * If true, shows "latest" instead of the version ID
       */
      isLatest?: boolean;
      tag?: never;
    }
);

const truncatedIdCSS = css`
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: default;
`;

/**
 * Displays a prompt version badge.
 *
 * Three display modes:
 * - Tag: semantic colors based on tag name (production=green, staging=yellow, development=blue)
 * - Latest: blue "latest" token when isLatest is true
 * - Version ID: truncated ID with dotted underline (hover shows full ID)
 */
export function PromptBadge(props: PromptBadgeProps) {
  const { size = "M", maxWidth } = props;

  // Tag mode
  if ("tag" in props && props.tag !== undefined) {
    const color = getTagColor(props.tag);
    return (
      <Token size={size} color={color} maxWidth={maxWidth} title={props.tag}>
        {props.tag}
      </Token>
    );
  }

  // Version mode
  const { versionId, isLatest } = props;

  // Latest mode
  if (isLatest) {
    return (
      <Token size={size} color="var(--ac-global-color-blue-1000)">
        latest
      </Token>
    );
  }

  // Truncated version ID mode
  const truncatedId = versionId.length > 6 ? versionId.slice(-6) : versionId;

  return (
    <Text size={size === "S" ? "XS" : "S"} css={truncatedIdCSS} title={versionId}>
      {truncatedId}
    </Text>
  );
}

function getTagColor(tag: string): string {
  switch (tag) {
    case "production":
      return "var(--ac-global-color-green-1000)";
    case "staging":
      return "var(--ac-global-color-yellow-1000)";
    case "development":
      return "var(--ac-global-color-blue-1000)";
    default:
      return "var(--ac-global-color-grey-900)";
  }
}
