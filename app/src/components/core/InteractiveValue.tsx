import { css } from "@emotion/react";
import type { HTMLProps, ReactNode, Ref } from "react";
import { forwardRef } from "react";

import { Icon, Icons } from "./icon";
import type { StylableProps } from "./types";

interface InteractiveValueProps
  extends Omit<HTMLProps<HTMLSpanElement>, "css">, StylableProps {
  children?: ReactNode;
}

const interactiveValueCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);
  font-family: "Geist Mono", monospace;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  padding: var(--global-dimension-static-size-25)
    var(--global-dimension-static-size-50);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-color-gray-200);
  background: transparent;
  color: var(--global-text-color-500);
  user-select: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--global-color-gray-100);
    border-color: var(--global-color-gray-300);
    color: var(--global-text-color-700);
  }
`;

const valueCSS = css`
  white-space: nowrap;
`;

const iconCSS = css`
  flex-shrink: 0;
  font-size: 1rem;
`;

function InteractiveValue(
  { children, css: cssProp, ...rest }: InteractiveValueProps,
  ref: Ref<HTMLSpanElement>
) {
  return (
    <span ref={ref} css={css(interactiveValueCSS, cssProp)} {...rest}>
      <Icon svg={<Icons.EntityId />} css={iconCSS} />
      <span className="interactive-value__value" css={valueCSS}>
        {children}
      </span>
    </span>
  );
}

const _InteractiveValue = forwardRef(InteractiveValue);
export { _InteractiveValue as InteractiveValue };
export type { InteractiveValueProps };
