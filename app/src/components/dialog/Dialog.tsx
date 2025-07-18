import { forwardRef, HTMLAttributes } from "react";
import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { Button, ButtonProps } from "@phoenix/components/button";
import { Heading, HeadingProps } from "@phoenix/components/content";
import { Icon, Icons } from "@phoenix/components/icon";
import { Flex, FlexProps } from "@phoenix/components/layout";

export type DialogProps = AriaDialogProps;

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  ({ children, ...props }, ref) => {
    return (
      <AriaDialog
        data-testid="dialog"
        {...props}
        className={classNames(props.className, "react-aria-Dialog")}
        ref={ref}
      >
        {children}
      </AriaDialog>
    );
  }
);

Dialog.displayName = "Dialog";

export type DialogContentProps = FlexProps;

export const DialogContent = ({ children, ...props }: DialogContentProps) => {
  return (
    <Flex
      direction="column"
      height="100%"
      data-testid="dialog-content"
      {...props}
      className={classNames(props.className, "react-aria-DialogContent")}
    >
      {children}
    </Flex>
  );
};

export type DialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export const dialogHeaderCSS = css`
  padding: var(--ac-global-dimension-size-100)
    var(--ac-global-dimension-size-200);
  border-bottom: var(--ac-global-border-size-thin) solid
    var(--ac-global-border-color-dark);
  flex-shrink: 0;
`;

export const DialogHeader = ({ children, ...props }: DialogHeaderProps) => {
  return (
    <div
      {...props}
      css={dialogHeaderCSS}
      className={classNames(props.className, "ac-DialogHeader")}
    >
      <Flex width="100%" justifyContent="space-between" alignItems="center">
        {children}
      </Flex>
    </div>
  );
};

export type DialogTitleProps = HeadingProps;

export const DialogTitle = ({ children, ...props }: DialogTitleProps) => {
  return (
    <Heading
      level={2}
      data-testid="dialog-title"
      {...props}
      className={classNames(props.className, "ac-DialogTitle")}
    >
      {children}
    </Heading>
  );
};

export type DialogTitleExtraProps = FlexProps;

export const DialogTitleExtra = ({
  children,
  ...props
}: DialogTitleExtraProps) => {
  return (
    <Flex
      gap="size-100"
      alignItems="center"
      data-testid="dialog-title-extra"
      {...props}
      className={classNames(props.className, "ac-DialogTitleExtra")}
    >
      {children}
    </Flex>
  );
};

export type DialogCloseButtonProps = ButtonProps & {
  close?: () => void;
};

/**
 * Close button for a dialog.
 * Either provide an imperative `close` prop or a `slot="close"` prop.
 */
export const DialogCloseButton = ({
  children,
  close,
  onPress,
  ...props
}: DialogCloseButtonProps) => {
  return (
    <Button
      size="S"
      data-testid="dialog-close-button"
      leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
      onPress={(e) => {
        close?.();
        onPress?.(e);
      }}
      type="button"
      slot="close"
      {...props}
      className={classNames(props.className, "ac-DialogCloseButton")}
    >
      {children}
    </Button>
  );
};
