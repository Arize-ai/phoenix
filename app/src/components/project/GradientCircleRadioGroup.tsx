import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { StylableProps } from "@phoenix/components/types";
import { classNames } from "@phoenix/utils";

const gradientCircleRadioGroupCSS = css`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: fit-content;
  gap: var(--ac-global-dimension-size-100);
  font-size: var(--ac-global-dimension-static-font-size-100);

  &[data-direction="row"] {
    flex-direction: row;
    flex-wrap: wrap;

    .react-aria-Label {
      flex-basis: 100%;
      margin-bottom: var(--ac-global-dimension-size-100);
    }

    [slot="description"] {
      flex-basis: 100%;
      margin-top: var(--ac-global-dimension-size-50);
    }
  }

  &[data-direction="column"] {
    flex-direction: column;
    align-items: flex-start;
  }

  &[data-disabled] {
    opacity: 0.5;
  }

  &[data-readonly] {
    .gradient-circle-radio {
      opacity: 0.7;
      cursor: default;
    }
  }

  &:has(.gradient-circle-radio[data-focus-visible]) {
    border-radius: var(--ac-global-rounding-small);
    outline: 1px solid var(--ac-global-color-primary);
    outline-offset: var(--ac-global-dimension-size-50);
  }
`;

export interface GradientCircleRadioGroupProps extends AriaRadioGroupProps {
  direction?: "row" | "column";
}

export function GradientCircleRadioGroup({
  css: cssProp,
  className,
  direction = "row",
  ...props
}: GradientCircleRadioGroupProps & StylableProps) {
  return (
    <AriaRadioGroup
      data-direction={direction}
      className={classNames("gradient-circle-radio-group", className)}
      css={css(fieldBaseCSS, gradientCircleRadioGroupCSS, cssProp)}
      {...props}
    />
  );
}
