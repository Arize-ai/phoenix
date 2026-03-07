import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { forwardRef } from "react";
import type { SwitchProps as AriaSwitchProps } from "react-aria-components";
import { Switch as AriaSwitch } from "react-aria-components";

const switchCSS = css`
  --switch-track-width: var(--global-dimension-static-size-450);
  --switch-track-height: var(--global-dimension-static-size-250);
  --switch-track-bg: var(--global-color-gray-400);
  --switch-track-bg-selected: var(--global-color-primary);
  --switch-thumb-size: var(--global-dimension-static-size-200);
  --switch-thumb-bg: var(--global-color-gray-900);
  --switch-thumb-bg-selected: var(--global-color-gray-50);
  --switch-thumb-inset: var(--global-dimension-static-size-25);

  display: flex;
  position: relative;
  align-items: center;
  gap: var(--global-dimension-size-100);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-m);
  line-height: var(--global-line-height-m);
  white-space: nowrap;
  cursor: pointer;

  .indicator {
    width: var(--switch-track-width);
    height: var(--switch-track-height);
    background: var(--switch-track-bg);
    border-radius: var(--global-rounding-full);
    transition: background 200ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    flex-shrink: 0;

    &:before {
      content: "";
      position: absolute;
      top: var(--switch-thumb-inset);
      left: var(--switch-thumb-inset);
      width: var(--switch-thumb-size);
      height: var(--switch-thumb-size);
      background: var(--switch-thumb-bg);
      border-radius: 50%;
      transition:
        transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
        background 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  &:not([data-disabled]):hover .indicator {
    opacity: 0.85;
  }

  &[data-selected] {
    .indicator {
      background: var(--switch-track-bg-selected);

      &:before {
        transform: translateX(
          calc(
            var(--switch-track-width) - var(--switch-thumb-size) - 2 *
              var(--switch-thumb-inset)
          )
        );
        background: var(--switch-thumb-bg-selected);
      }
    }

    &:not([data-disabled]):hover .indicator {
      opacity: 0.9;
    }
  }

  &[data-focus-visible] .indicator {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
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
