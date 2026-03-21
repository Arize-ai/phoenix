import { Badge } from "@phoenix/components/core/badge";
import { Text } from "@phoenix/components/core/content";
import { Icon } from "@phoenix/components/core/icon";
import type { ComponentSize } from "@phoenix/components/core/types";

interface IDBadgeProps {
  /**
   * The ID value to display in the badge.
   */
  id: string;
  /**
   * The size of the badge.
   * @default 'S'
   */
  size?: ComponentSize;
}

export const IDBadge = ({ id, size = "S" }: IDBadgeProps) => {
  return (
    <Badge size={size}>
      <Icon svgKey="IDOutline" />
      <Text fontFamily="mono" size="S" color="text-700">
        {id}
      </Text>
    </Badge>
  );
};
