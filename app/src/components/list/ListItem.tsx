import { forwardRef, HTMLProps } from "react";

function ListItem({ children, ...props }: HTMLProps<HTMLLIElement>) {
  return <li {...props}>{children}</li>;
}

const _ListItem = forwardRef(ListItem);
export { _ListItem as ListItem };
