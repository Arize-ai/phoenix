import { forwardRef, PropsWithChildren } from "react";

function ListItem({ children }: PropsWithChildren) {
  return <li>{children}</li>;
}

const _ListItem = forwardRef(ListItem);
export { _ListItem as ListItem };
