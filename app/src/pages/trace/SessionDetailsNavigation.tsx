import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { popoverSurfaceCSS } from "@phoenix/components/core/overlay/styles";

type SessionDetailsNavigationRenderOptions = {
  isOverlayOpen: boolean;
};

const sessionDetailsNavigationCSS = css`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow: visible;

  .session-details-navigation__content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    background: var(--global-background-color-default);
  }

  .session-details-navigation__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .session-view-control__compact {
    display: none;
  }

  .session-turn-row__compact-index,
  .session-trace-row-header__compact-index {
    display: none;
  }

  &[data-collapsed="true"] {
    .session-details-navigation__content {
      flex: 0 0 var(--trace-tree-overlay-width);
      min-width: var(--trace-tree-overlay-width);
      width: var(--trace-tree-overlay-width);
    }

    .session-turn-row,
    .session-trace-row-header {
      padding-top: var(--global-dimension-size-150);
      padding-left: var(--global-dimension-size-150);
    }
  }

  &[data-collapsed="true"][data-open="false"] {
    overflow: hidden;

    .session-view-control__expanded {
      display: none;
    }

    .session-view-control__compact {
      display: flex;
    }

    .session-turn-row__compact-index,
    .session-trace-row-header__compact-index {
      position: absolute;
      top: var(--global-dimension-size-150);
      left: var(--global-dimension-size-150);
      z-index: var(--global-z-index-local-raised);
      display: inline-flex;
      justify-content: flex-start;
      width: var(--global-dimension-size-200);
      text-align: left;
    }

    .session-turn-row__expanded-content,
    .session-trace-row-header__expanded-content,
    .session-trace-row-chevron {
      visibility: hidden;
    }
  }

  &[data-open="true"] {
    overflow: visible;

    .session-details-navigation__content {
      ${popoverSurfaceCSS}
      position: absolute;
      top: 0;
      left: 0;
      z-index: var(--global-z-index-local-overlay);
      height: 100%;
      border-color: var(--global-border-color-default);
      border-radius: var(--global-rounding-small);
    }
  }
`;

/**
 * Keeps session navigation laid out at its preferred width while compact mode
 * clips it to the rail. Hovering or focusing the list reveals that same DOM as
 * an overlay, preserving row heights, tree state, and scroll position.
 */
export function SessionDetailsNavigation({
  children,
  control,
  isCollapsed,
  isPointerOpen,
  onPointerOpenChange,
}: {
  children:
    | ReactNode
    | ((options: SessionDetailsNavigationRenderOptions) => ReactNode);
  control: ReactNode;
  isCollapsed: boolean;
  isPointerOpen: boolean;
  onPointerOpenChange: (isOpen: boolean) => void;
}) {
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const isOpen = isCollapsed && (isPointerOpen || isFocusOpen);
  const navigationBody =
    typeof children === "function"
      ? children({ isOverlayOpen: isOpen })
      : children;

  return (
    <div
      className="session-details-navigation"
      css={sessionDetailsNavigationCSS}
      data-collapsed={isCollapsed}
      data-open={isOpen}
    >
      <div
        className="session-details-navigation__content"
        data-open={isOpen}
        onPointerLeave={() => onPointerOpenChange(false)}
        onBlur={(event) => {
          const nextFocusedElement = event.relatedTarget;
          if (
            !(nextFocusedElement instanceof Node) ||
            !event.currentTarget.contains(nextFocusedElement)
          ) {
            setIsFocusOpen(false);
          }
        }}
      >
        {control}
        <div
          className="session-details-navigation__body"
          onPointerEnter={() => onPointerOpenChange(true)}
          onFocus={() => setIsFocusOpen(true)}
        >
          {navigationBody}
        </div>
      </div>
    </div>
  );
}
