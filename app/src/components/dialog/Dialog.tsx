import { forwardRef } from "react";
import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
} from "react-aria-components";

import { Button, ButtonProps } from "@phoenix/components/button";
import { Heading, HeadingProps } from "@phoenix/components/content";
import { Icon, Icons } from "@phoenix/components/icon";
import { Flex, FlexProps } from "@phoenix/components/layout";
import { View, ViewProps } from "@phoenix/components/view";

export type DialogProps = AriaDialogProps;

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  ({ children, ...props }, ref) => {
    return (
      <AriaDialog data-testid="dialog" {...props} ref={ref}>
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
    >
      {children}
    </Flex>
  );
};

export type DialogHeaderProps = ViewProps;

export const DialogHeader = ({ children, ...props }: DialogHeaderProps) => {
  return (
    <View
      paddingY="size-100"
      paddingX="size-200"
      flexShrink={0}
      borderBottomColor="dark"
      borderBottomWidth={"thin"}
      data-testid="dialog-header"
      {...props}
    >
      <Flex width="100%" justifyContent="space-between" alignItems="center">
        {children}
      </Flex>
    </View>
  );
};

export type DialogTitleProps = HeadingProps;

export const DialogTitle = ({ children, ...props }: DialogTitleProps) => {
  return (
    <Heading level={2} data-testid="dialog-title" {...props}>
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
    >
      {children}
    </Button>
  );
};
