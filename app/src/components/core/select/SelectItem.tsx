import type { ReactNode, Ref } from "react";
import type { ListBoxItemProps } from "react-aria-components";
import { ListBoxItem } from "react-aria-components";

import { Icon, Icons } from "../icon";
import { Flex } from "../layout";

interface SelectItemProps extends ListBoxItemProps {
  children: ReactNode;
}

/**
 * A ListBoxItem specifically that shows a checkbox icon where the item is selected.
 */
export function SelectItem({
  ref,
  children,
  ...restProps
}: SelectItemProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <ListBoxItem {...restProps} ref={ref}>
      {({ isSelected }) => {
        return (
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <span>{children}</span>
            {isSelected && <Icon svg={<Icons.Checkmark />} />}
          </Flex>
        );
      }}
    </ListBoxItem>
  );
}

SelectItem.displayName = "SelectItem";
