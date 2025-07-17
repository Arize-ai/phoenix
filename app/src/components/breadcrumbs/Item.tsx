import { ReactNode } from "react";

export interface ItemProps {
  children: ReactNode;
  className?: string;
}

export function Item({ children, className }: ItemProps) {
  return <span className={className}>{children}</span>;
}
