import { PropsWithChildren, useLayoutEffect, useRef, useState } from "react";
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
  height: var(--ac-global-dimension-size-500);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--ac-global-dimension-size-50);
  padding-bottom: var(--ac-global-dimension-size-50);
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--ac-global-background-color-dark) 100%
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
  /**
   * Maximum height in pixels before overflow is triggered
   * @default 150
   */
  height?: number;
}

export function OverflowCell({ children, height = 150 }: OverflowCellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // NB: need to figure out why calculation is incorrect
  const [isOverflowing, setIsOverflowing] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (content && container) {
      // Compare content's natural height against container's actual height
      setIsOverflowing(content.scrollHeight > container.clientHeight);
    }
  }, [children, height]);

  return (
    <div
      ref={containerRef}
      css={containerCSS}
      style={{ height }}
      className="overflow-cell"
    >
      <div
        ref={contentRef}
        css={contentCSS}
        data-expanded={isExpanded}
        style={{ height: "100%" }}
      >
        {children}
      </div>
      {isOverflowing && !isExpanded && (
        <button
          className="button--reset"
          css={expandButtonCSS}
          onClick={() => setIsExpanded(true)}
          aria-label="Show more"
        >
          <span>expand</span>
          <Icon svg={<Icons.ArrowIosDownwardOutline />} />
        </button>
      )}
    </div>
  );
}
