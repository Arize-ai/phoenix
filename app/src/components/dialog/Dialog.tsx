import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
} from "react-aria-components";

export type DialogProps = { variant?: "defaul" } & AriaDialogProps;

export const Dialog = ({ children, ...props }: DialogProps) => {
  return <AriaDialog {...props}>{children}</AriaDialog>;
};
