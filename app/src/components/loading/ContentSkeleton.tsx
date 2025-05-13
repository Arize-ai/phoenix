import { Flex } from "@phoenix/components";

import { StylableProps } from "../types/style";

import { Skeleton } from "./Skeleton";

interface ContentSkeletonProps extends StylableProps {}
/**
 * A skeleton component for the content of a card or other container.
 */
export const ContentSkeleton = (props: ContentSkeletonProps) => {
  return (
    <Flex direction="column" gap="size-100" width="100%" {...props}>
      <Skeleton height={100} borderRadius={8} animation="wave" />
      <Skeleton height={24} width="80%" animation="wave" />
      <Skeleton height={16} width="60%" animation="wave" />
    </Flex>
  );
};
