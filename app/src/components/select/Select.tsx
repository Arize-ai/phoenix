import { forwardRef, Ref } from "react";
import {
  Select as AriaSelect,
  SelectProps as AriaSelectProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { SizingProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts";

import { fieldBaseCSS } from "../field/styles";

export interface SelectProps extends AriaSelectProps, SizingProps {}

const selectCSS = css`
  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 200px;
    width: 100%;

    &[data-pressed],
    &:hover {
      --button-border-color: var(--ac-global-input-field-border-color-active);
    }
  }

  button[data-size="S"][data-childless="false"] {
    padding-right: var(--ac-global-dimension-size-50);
  }

  button[data-size="M"][data-childless="false"] {
    padding-right: var(--ac-global-dimension-size-100);
  }

  .react-aria-SelectValue {
    &[data-placeholder] {
      font-style: italic;
      color: var(--ac-text-color-placeholder);
    }
  }
`;

function Select(props: SelectProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <SizeProvider size={size}>
      <AriaSelect
        data-size={size}
        className="ac-select"
        ref={ref}
        {...otherProps}
        css={css(fieldBaseCSS, selectCSS)}
      />
    </SizeProvider>
  );
}

const _Select = forwardRef(Select);

export { _Select as Select };
