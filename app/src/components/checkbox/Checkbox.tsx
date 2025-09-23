import { forwardRef, Ref } from "react";
import { Checkbox as AriaCheckbox, CheckboxProps } from "react-aria-components";

import { checkboxCSS } from "@phoenix/components/checkbox/styles";

function Checkbox(props: CheckboxProps, ref: Ref<HTMLLabelElement>) {
  const { children, ...restProps } = props;
  return (
    <AriaCheckbox {...restProps} ref={ref} css={checkboxCSS}>
      {({ isIndeterminate }) => (
        <>
          <div className="checkbox">
            <svg viewBox="0 0 18 18" aria-hidden="true">
              {isIndeterminate ? (
                <rect x={1} y={7.5} width={15} height={3} />
              ) : (
                <polyline points="1 9 7 14 15 4" />
              )}
            </svg>
          </div>
          {children}
        </>
      )}
    </AriaCheckbox>
  );
}

const _Checkbox = forwardRef(Checkbox);
export { _Checkbox as Checkbox };
