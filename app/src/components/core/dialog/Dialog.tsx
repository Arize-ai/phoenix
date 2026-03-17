import { css } from "@emotion/react";
import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
} from "react-aria-components";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import type { HeadingProps } from "@phoenix/components/core/content";
import { Heading } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import type { FlexProps } from "@phoenix/components/core/layout";
import { Flex } from "@phoenix/components/core/layout";
import { classNames } from "@phoenix/utils/classNames";

export type DialogProps = AriaDialogProps;

const dialogCSS = css`
  overscroll-behavior: none !important;
`;

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  ({ children, ...props }, ref) => {
    return (
      <AriaDialog
        data-testid="dialog"
        {...props}
        css={dialogCSS}
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
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  flex-shrink: 0;
`;

export const DialogHeader = ({ children, ...props }: DialogHeaderProps) => {
  return (
    <div
      {...props}
      css={dialogHeaderCSS}
      className={classNames(props.className, "dialog__header")}
    >
      <Flex
        width="100%"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
      >
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
      slot="title"
      {...props}
      className={classNames(props.className, "dialog__title")}
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
      className={classNames(props.className, "dialog__title-extra")}
    >
      {children}
    </Flex>
  );
};

export type DialogFooterProps = HTMLAttributes<HTMLDivElement>;

const dialogFooterCSS = css`
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  flex-shrink: 0;
`;

export const DialogFooter = ({ children, ...props }: DialogFooterProps) => {
  return (
    <div
      {...props}
      css={dialogFooterCSS}
      className={classNames(props.className, "dialog__footer")}
    >
      <Flex
        width="100%"
        justifyContent="end"
        alignItems="center"
        gap="size-100"
      >
        {children}
      </Flex>
    </div>
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
      className={classNames(props.className, "dialog__close-button")}
    >
      {children}
    </Button>
  );
};
