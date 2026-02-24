import { css } from "@emotion/react";
import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import type { StylableProps } from "@phoenix/components/types";
import { classNames } from "@phoenix/utils";

const gradientCircleRadioGroupCSS = css`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: fit-content;
  gap: var(--global-dimension-size-100);
  font-size: var(--global-dimension-static-font-size-100);

  &[data-direction="row"] {
    flex-direction: row;
    flex-wrap: wrap;

    .react-aria-Label {
      flex-basis: 100%;
      margin-bottom: var(--global-dimension-size-100);
    }

    [slot="description"] {
      flex-basis: 100%;
      margin-top: var(--global-dimension-size-50);
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
    border-radius: var(--global-rounding-small);
    outline: 1px solid var(--global-color-primary);
    outline-offset: var(--global-dimension-size-50);
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
