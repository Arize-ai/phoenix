import { forwardRef, ReactNode } from "react";
import { ListBoxItem, ListBoxItemProps } from "react-aria-components";

import { Flex, Icon, Icons } from "@phoenix/components";

interface SelectItemProps extends ListBoxItemProps {
  children: ReactNode;
}

/**
 * A ListBoxItem specifically that shows a checkbox icon where the item is selected.
 */
const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>((props, ref) => {
  const { children, ...restProps } = props;
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
});

SelectItem.displayName = "SelectItem";

export { SelectItem };
