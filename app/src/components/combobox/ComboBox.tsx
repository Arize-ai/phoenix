import React from "react";
import {
  Button,
  ComboBox as AriaComboBox,
  ComboBoxProps as AriaComboBoxProps,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxItemProps as AriaListBoxItemProps,
  ListBoxProps,
  Popover,
  Text,
  ValidationResult,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";

import { SelectChevronUpDownIcon } from "../select";

import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children">,
    SizingProps,
    Pick<ListBoxProps<T>, "renderEmptyState"> {
  label?: string;
  placeholder?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
  /**
   * The container to render the popover into. If not provided, the popover will be rendered in the body.
   * @default document.body
   */
  container?: HTMLElement;
  /**
   * The width of the combobox. If not provided, the combobox will be sized to fit its contents. with a minimum width of 200px.
   */
  width?: string;
  /**
   * If true, click and keypress events will not propagate to the parent element.
   *
   * This is useful when nesting the combobox within containers that have onClick handlers,
   * but should be used sparingly.
   */
  stopPropagation?: boolean;
}

/**
 * Prevents the event from propagating to the parent element.
 */
const stopPropagationHandler = (e: React.MouseEvent | React.KeyboardEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function ComboBox<T extends object>({
  label,
  placeholder,
  description,
  errorMessage,
  children,
  container,
  size = "M",
  width,
  stopPropagation,
  renderEmptyState,
  isInvalid,
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox
      {...props}
      css={css(fieldBaseCSS, comboBoxCSS)}
      data-size={size}
      isInvalid={isInvalid || Boolean(errorMessage)}
      style={{
        width,
      }}
    >
      {label && <Label>{label}</Label>}
      <div
        className="px-combobox-container"
        // Prevent interactions with the combobox components from propagating above this element
        // This allows us to nest the combobox within containers that have onClick handlers
        onClick={stopPropagation ? stopPropagationHandler : undefined}
        onKeyDown={stopPropagation ? stopPropagationHandler : undefined}
        onKeyUp={stopPropagation ? stopPropagationHandler : undefined}
      >
        <Input placeholder={placeholder} />
        <Button>
          <SelectChevronUpDownIcon />
        </Button>
      </div>
      {description && !errorMessage ? (
        <Text slot="description">{description}</Text>
      ) : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover css={comboBoxPopoverCSS} UNSTABLE_portalContainer={container}>
        <ListBox renderEmptyState={renderEmptyState}>{children}</ListBox>
      </Popover>
    </AriaComboBox>
  );
}

export interface ListBoxItemProps<T = object>
  extends Omit<AriaListBoxItemProps<T>, "textValue"> {
  /**
   * A string representation of the item's contents, used for features like typeahead.
   **/
  textValue: string;
}

export function ComboBoxItem(props: ListBoxItemProps) {
  const { children, ...rest } = props;
  return (
    <ListBoxItem {...rest} css={comboBoxItemCSS}>
      {({ isSelected }) => {
        return (
          <>
            {children}
            {isSelected && (
              <Icon
                svg={<Icons.CheckmarkOutline />}
                className="px-menu-item__selected-checkmark"
              />
            )}
          </>
        );
      }}
    </ListBoxItem>
  );
}
