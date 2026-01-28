import {
  memo,
  PropsWithChildren,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

const containerCSS = css`
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const contentCSS = css`
  height: 100%;
  overflow: hidden;

  // When collapsed, prevent all nested elements from scrolling
  &:not([data-expanded="true"]) {
    * {
      overflow: hidden !important;
    }
  }

  &[data-expanded="true"] {
    overflow: auto;
  }
`;

const expandButtonCSS = css`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--ac-global-dimension-size-50);
  padding-bottom: var(--ac-global-dimension-size-100);
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--ac-global-background-color-default) 80%,
    var(--ac-global-background-color-default) 100%
  );
  cursor: pointer;
  border: none;
  font-size: var(--ac-global-font-size-s);
  color: var(--ac-global-text-color-500);
  transition: color 0.2s ease-in-out;

  .ac-icon-wrap {
    font-size: var(--ac-global-font-size-m);
    color: inherit;
  }

  &:hover {
    color: var(--ac-global-color-primary);
  }
`;

export interface OverflowCellProps extends PropsWithChildren {
  height: number;
  /**
   * Controlled expanded state. If provided, the component will use this value
   * instead of managing its own internal state.
   */
  isExpanded?: boolean;
  /**
   * Callback fired when the expanded state changes.
   * Use this with `isExpanded` for controlled mode.
   */
  onExpandedChange?: (isExpanded: boolean) => void;
}

export const OverflowCell = memo(function OverflowCell({
  children,
  height,
  isExpanded: controlledExpanded,
  onExpandedChange,
}: OverflowCellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // NB: need to figure out why calculation is incorrect
  const [isOverflowing, setIsOverflowing] = useState(true);
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Use controlled value if provided, otherwise use internal state
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  useLayoutEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (content && container) {
      // Compare content's natural height against container's actual height
      setIsOverflowing(content.scrollHeight > container.clientHeight);
    }
  }, [children, height]);

  const handleExpand = useCallback(() => {
    if (!isControlled) {
      setInternalExpanded(true);
    }
    onExpandedChange?.(true);
  }, [isControlled, onExpandedChange]);

  return (
    <div
      ref={containerRef}
      css={containerCSS}
      style={{ height }}
      className="overflow-cell"
    >
      <div ref={contentRef} css={contentCSS} data-expanded={isExpanded}>
        {children}
      </div>
      {isOverflowing && !isExpanded && (
        <button
          className="expand-button button--reset"
          css={expandButtonCSS}
          onClick={handleExpand}
          aria-label="Show more"
        >
          <span>expand</span>
          <Icon svg={<Icons.ArrowIosDownwardOutline />} />
        </button>
      )}
    </div>
  );
});
