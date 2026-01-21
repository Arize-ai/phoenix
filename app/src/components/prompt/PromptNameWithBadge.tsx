import { Flex, Text } from "@phoenix/components";
import { TokenProps } from "@phoenix/components/token";
import { Truncate } from "@phoenix/components/utility/Truncate";

import { PromptBadge } from "./PromptBadge";

type PromptNameWithBadgeProps = {
  /**
   * The prompt name to display
   */
  name: string;
  /**
   * Size of the badge
   * @default "S"
   */
  size?: TokenProps["size"];
  /**
   * Maximum width for truncating the name and badge
   * @default "30rem"
   */
  maxWidth?: string;
} & (
  | {
      /**
       * Tag name to display
       */
      tag: string;
      versionId?: never;
      isLatest?: never;
    }
  | {
      /**
       * Version ID to display
       */
      versionId: string;
      /**
       * If true, shows "latest" instead of the version ID
       */
      isLatest?: boolean;
      tag?: never;
    }
);

/**
 * Displays a prompt name with version badge in the format: "name @ badge"
 *
 * Examples:
 * - "my-prompt @ production" (tag mode)
 * - "my-prompt @ latest" (isLatest mode)
 * - "my-prompt @ abc123" (version ID mode)
 */
export function PromptNameWithBadge(props: PromptNameWithBadgeProps) {
  const { name, size = "S", maxWidth = "30rem" } = props;

  const badgeProps =
    "tag" in props && props.tag !== undefined
      ? { tag: props.tag }
      : { versionId: props.versionId, isLatest: props.isLatest };

  return (
    <Flex alignItems="center">
      <Truncate maxWidth={maxWidth}>{name}</Truncate>
      <Text color="text-300">&nbsp;@&nbsp;</Text>
      <PromptBadge size={size} maxWidth={maxWidth} {...badgeProps} />
    </Flex>
  );
}
