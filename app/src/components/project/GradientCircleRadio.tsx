import {
  Radio as AriaRadio,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/utils";
import { StylableProps } from "@phoenix/components/types";

import { GradientCircle } from "./GradientCircle";

const gradientCircleRadioCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);
  padding: var(--ac-global-dimension-size-100);
  border: 2px solid transparent;
  border-radius: var(--ac-global-rounding-medium);
  cursor: pointer;
  transition: all 200ms ease;
  position: relative;
  background: transparent;

  /* Hover state */
  &[data-hovered]:not([data-disabled]):not([data-selected]) {
    border-color: var(--ac-global-color-grey-200);
  }

  /* Selected state */
  &[data-selected] {
    background-color: var(--ac-global-color-primary-50);
    border-color: var(--ac-global-color-primary);
  }

  /* Pressed state */
  &[data-pressed] {
    transform: scale(0.98);
  }

  /* Focus visible state */
  &[data-focus-visible] {
    outline: 2px solid var(--ac-global-color-primary);
    outline-offset: 2px;
  }

  /* Disabled state */
  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Label text styling */
  .gradient-circle-radio__label {
    font-size: var(--ac-global-dimension-static-font-size-75);
    color: var(--ac-global-text-color-700);
    text-align: center;
    font-weight: 500;
  }

  &[data-selected] .gradient-circle-radio__label {
    color: var(--ac-global-color-primary);
    font-weight: 600;
  }
`;

export interface GradientCircleRadioProps extends AriaRadioProps {
  gradientStartColor: string;
  gradientEndColor: string;
  label?: string;
  size?: number;
}

export function GradientCircleRadio({
  gradientStartColor,
  gradientEndColor,
  label,
  size = 32,
  className,
  css: cssProp,
  ...props
}: GradientCircleRadioProps & StylableProps) {
  return (
    <AriaRadio
      className={classNames("gradient-circle-radio", className)}
      css={css(gradientCircleRadioCSS, cssProp)}
      {...props}
    >
      <GradientCircle
        gradientStartColor={gradientStartColor}
        gradientEndColor={gradientEndColor}
        size={size}
      />
      {label && <span className="gradient-circle-radio__label">{label}</span>}
    </AriaRadio>
  );
}
