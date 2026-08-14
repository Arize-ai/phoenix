import type { HTMLProps, Ref } from "react";

function ListItem({
  ref,
  children,
  ...props
}: HTMLProps<HTMLLIElement> & { ref?: Ref<HTMLLIElement> }) {
  return (
    <li ref={ref} {...props}>
      {children}
    </li>
  );
}

export { ListItem };
