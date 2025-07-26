import { forwardRef, HTMLProps, Ref } from "react";

function ListItem(
  { children, ...props }: HTMLProps<HTMLLIElement>,
  ref: Ref<HTMLLIElement>
) {
  return (
    <li ref={ref} {...props}>
      {children}
    </li>
  );
}

const _ListItem = forwardRef(ListItem);
export { _ListItem as ListItem };
