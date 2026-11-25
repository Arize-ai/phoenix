import { css } from "@emotion/react";
import type { ReactNode } from "react";
import React, { Fragment } from "react";
import type {
  ComboBoxProps as AriaComboBoxProps,
  ListBoxItemProps as AriaListBoxItemProps,
  ListBoxProps,
  ValidationResult,
} from "react-aria-components";
import {
  Button,
  ComboBox as AriaComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Text,
} from "react-aria-components";

import { fieldBaseCSS } from "../field/styles";
import { Icon, Icons, SelectChevronUpDownIcon } from "../icon";
import { Popover } from "../overlay";
import type { SizingProps } from "../types";
import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends
    Omit<AriaComboBoxProps<T>, "children">,
    SizingProps,
    Pick<ListBoxProps<T>, "renderEmptyState"> {
  label?: string;
  placeholder?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
  /**
   * The width of the combobox. If not provided, the combobox will be sized to fit its contents. with a minimum width of 200px.
   * @default "100%"
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
const stopPropagationHandler = (
  event: React.MouseEvent | React.KeyboardEvent
) => {
  event.stopPropagation();
};

export function ComboBox<T extends object>({
  label,
  placeholder,
  description,
  errorMessage,
  children,
  size = "M",
  width,
  stopPropagation,
  renderEmptyState,
  isInvalid,
  menuTrigger = "focus",
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox
      {...props}
      menuTrigger={menuTrigger}
      css={css(fieldBaseCSS, comboBoxCSS)}
      data-size={size}
      isInvalid={isInvalid || Boolean(errorMessage)}
      style={{
        width,
      }}
      allowsEmptyCollection={!!renderEmptyState}
    >
      {label && <Label>{label}</Label>}
      <div
        className="combobox__container"
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
      <Popover css={comboBoxPopoverCSS}>
        <ListBox renderEmptyState={renderEmptyState}>{children}</ListBox>
      </Popover>
    </AriaComboBox>
  );
}

export interface ListBoxItemProps<T = object> extends Omit<
  AriaListBoxItemProps<T>,
  "textValue"
> {
  /**
   * A string representation of the item's contents, used for features like typeahead.
   **/
  textValue: string;
}

/**
 * Browsers break long text after a space or a hyphen, but not after the
 * separators that join the words of an identifier, so a name such as
 * `support_ticket_classifier` or a path such as `metadata.retrieval.documents`
 * would otherwise wrap at an arbitrary character.
 */
const IDENTIFIER_SEPARATOR_PATTERN = /(?<=[_./:\\])/;

/**
 * Adds a `<wbr>` after each identifier separator. `<wbr>` adds no text, so the
 * option's text content, and with it its accessible name, is unchanged.
 */
function insertWordBreakOpportunities(text: string): ReactNode {
  const segments = text.split(IDENTIFIER_SEPARATOR_PATTERN);
  if (segments.length === 1) {
    return text;
  }
  return segments.map((segment, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {segment}
    </Fragment>
  ));
}

export function ComboBoxItem(props: ListBoxItemProps) {
  const { children, ...rest } = props;
  return (
    <ListBoxItem {...rest} css={comboBoxItemCSS}>
      {(renderProps) => {
        const content =
          typeof children === "function" ? children(renderProps) : children;
        return (
          <>
            <div className="combobox-item__content">
              {typeof content === "string"
                ? insertWordBreakOpportunities(content)
                : content}
            </div>
            {renderProps.isSelected && (
              <Icon
                svg={<Icons.Checkmark />}
                className="menu-item__selected-checkmark"
              />
            )}
          </>
        );
      }}
    </ListBoxItem>
  );
}
