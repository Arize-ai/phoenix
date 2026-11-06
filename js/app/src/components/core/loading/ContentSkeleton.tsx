import { Flex } from "../layout";
import type { StylableProps } from "../types/style";
import { Skeleton } from "./Skeleton";

/**
 * A skeleton component for the content of a card or other container.
 */
export const ContentSkeleton = (props: StylableProps) => {
  return (
    <Flex direction="column" gap="size-100" width="100%" {...props}>
      <Skeleton height={100} borderRadius="medium" />
      <Skeleton height={24} width="80%" />
      <Skeleton height={16} width="60%" />
    </Flex>
  );
};
