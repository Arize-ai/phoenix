import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps, StylableProps } from "@phoenix/components/types";

const baseRadioGroupCSS = css(`
  // fixes esoteric overflow bug with VisuallyHidden, which is used by Radio
  // If position is not set to relative, the radio group will explode the parent layout
  // This will impact any other react aria component that uses VisuallyHidden
  // https://github.com/adobe/react-spectrum/issues/5094
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: fit-content;
  gap: var(--ac-global-dimension-size-200);
  font-size: var(--ac-global-dimension-static-font-size-100);

  & > .ac-radio:not(:first-child) {
    border-left: none;
  }

  & > .ac-radio:first-child {
    border-radius: var(--ac-global-rounding-small) 0 0 var(--ac-global-rounding-small);
  }

  & > .ac-radio:last-child {
    border-radius: 0 var(--ac-global-rounding-small) var(--ac-global-rounding-small) 0;
  }

  &[data-direction="row"] {
    flex-direction: row;
    flex-wrap: wrap;

    .react-aria-Label {
      flex-basis: 100%;
    }

    [slot="description"] {
      flex-basis: 100%;
    }
  }

  &[data-direction="column"] {
    flex-direction: column;
    align-items: flex-start;
  }

  &[data-size="S"] {
    .ac-radio {
      padding: var(--ac-global-dimension-size-25) var(--ac-global-dimension-size-100);
    }
  }

  &[data-size="L"] {
    .ac-radio {
      padding: var(--ac-global-dimension-size-100) var(--ac-global-dimension-size-150);
    }
  }

  &[data-disabled] {
    opacity: 0.5;
  }

  &[data-readonly] {
    .ac-radio:before {
      opacity: 0.5;
    }
  }

  &:has(.ac-radio[data-focus-visible]) {
    border-radius: var(--ac-global-rounding-small);
    outline: 1px solid var(--ac-global-input-field-border-color-active);
    // display an outline offset around the radio group, accounting for the outline offset of the inner radios
    outline-offset: var(--ac-global-dimension-size-100);
  }
`);

export type RadioGroupProps = AriaRadioGroupProps;

export const RadioGroup = ({
  size,
  css: cssProp,
  className,
  direction = "row",
  ...props
}: RadioGroupProps &
  SizingProps &
  StylableProps & { direction?: "row" | "column" }) => {
  return (
    <AriaRadioGroup
      data-size={size}
      data-direction={direction}
      className={classNames("ac-radio-group", className)}
      css={css(fieldBaseCSS, baseRadioGroupCSS, cssProp)}
      {...props}
    />
  );
};
