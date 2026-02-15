import { forwardRef, ReactNode, Ref } from "react";
import {
  Switch as AriaSwitch,
  SwitchProps as AriaSwitchProps,
} from "react-aria-components";
import { css } from "@emotion/react";

const switchCSS = css`
  display: flex;
  position: relative;
  align-items: center;
  gap: var(--global-dimension-size-100);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-m);
  line-height: var(--global-line-height-m);
  white-space: nowrap;

  .indicator {
    width: var(--global-dimension-size-400);
    height: var(--global-dimension-size-150);
    background: var(--global-color-gray-300);
    border-radius: var(--global-rounding-medium);
    transition: background 0.1s ease-in-out;
    position: relative;

    &:before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      width: var(--global-dimension-size-250);
      height: var(--global-dimension-size-250);
      background: var(--global-color-gray-500);
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.1s ease-in-out;
    }

    &:hover::after {
      content: "";
      position: absolute;
      top: 50%;
      left: calc(var(--global-dimension-size-250) / 2);
      transform: translate(-50%, -50%);
      width: var(--global-dimension-size-350);
      height: var(--global-dimension-size-350);
      background: var(--global-color-primary);
      border-radius: 50%;
      opacity: 0.4;
      transition: all 0.1s ease-in-out;
    }
  }

  &[data-selected] {
    .indicator {
      background: var(--global-color-primary-700);

      &:before {
        background: var(--global-color-primary);
        transform: translateY(-50%)
          translateX(
            calc(
              var(--global-dimension-size-400) - var(
                  --global-dimension-size-250
                )
            )
          );
      }

      &:hover::after {
        left: calc(
          var(--global-dimension-size-400) - var(
              --global-dimension-size-250
            ) +
            var(--global-dimension-size-250) / 2
        );
      }
    }
  }

  &[data-focus-visible] .indicator {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }

  &[data-label-placement="start"] {
    flex-direction: row-reverse;
  }

  &[data-label-placement="end"] {
    flex-direction: row;
  }
`;
export interface SwitchProps extends AriaSwitchProps {
  children: ReactNode;
  labelPlacement?: "start" | "end";
}

function Switch(
  { children, labelPlacement = "end", ...props }: SwitchProps,
  ref: Ref<HTMLLabelElement>
) {
  return (
    <AriaSwitch
      {...props}
      ref={ref}
      css={switchCSS}
      data-label-placement={labelPlacement}
    >
      <div className="indicator" />
      {children}
    </AriaSwitch>
  );
}

const _Switch = forwardRef(Switch);

export { _Switch as Switch };
