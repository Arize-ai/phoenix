import { Flex } from "../layout";
import type { StylableProps } from "../types/style";
import type { AnimationType } from "./Skeleton";
import { Skeleton } from "./Skeleton";

interface ContentSkeletonProps extends StylableProps {
  /**
   * The animation effect. If false, no animation is applied.
   * @default 'wave'
   */
  animation?: AnimationType;
}

/**
 * A skeleton component for the content of a card or other container.
 */
export const ContentSkeleton = ({
  animation = "wave",
  ...props
}: ContentSkeletonProps) => {
  return (
    <Flex direction="column" gap="size-100" width="100%" {...props}>
      <Skeleton height={100} borderRadius={8} animation={animation} />
      <Skeleton height={24} width="80%" animation={animation} />
      <Skeleton height={16} width="60%" animation={animation} />
    </Flex>
  );
};
