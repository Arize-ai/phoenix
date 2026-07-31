import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useFocusRing } from "react-aria";

import { popoverSurfaceCSS } from "@phoenix/components/core/overlay/styles";

type SessionDetailsNavigationRenderOptions = {
  isOverlayOpen: boolean;
};

export const sessionDetailsNavigationTopLevelRowCSS = css`
  /* ListBox gives its items generic padding through a descendant selector.
   * Repeat the row selector so this shared geometry wins that cascade. */
  && {
    /* The navigation list is a fixed-height flex column. Keep rows at their
     * content height so overflow scrolls the list instead of shrinking rows. */
    flex-shrink: 0;
    min-height: var(--global-details-panel-navigation-row-height);
    padding: var(
        --global-session-details-navigation-top-level-row-padding-block
      )
      var(--global-session-details-navigation-top-level-row-padding-inline-end)
      var(--global-session-details-navigation-top-level-row-padding-block)
      var(--global-details-panel-navigation-row-content-padding-inline-start);
  }
`;

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
  .session-trace-row-header__compact-index,
  .trace-summary-row__compact-index {
    display: none;
  }

  .session-turn-list,
  [data-testid="session-trace-row-list"] {
    scrollbar-color: var(--global-color-gray-300) transparent;
    scrollbar-gutter: stable;
  }

  .session-turn-row__title,
  .session-trace-row-header__title,
  .trace-summary-row__title {
    gap: var(--global-session-details-navigation-top-level-row-title-gap);
  }

  &[data-collapsed="true"] {
    .session-details-navigation__content {
      flex: 0 0 var(--trace-tree-overlay-width);
      min-width: var(--trace-tree-overlay-width);
      width: var(--trace-tree-overlay-width);
    }
  }

  &[data-collapsed="true"][data-open="false"] {
    overflow: hidden;

    .session-turn-list,
    [data-testid="session-trace-row-list"] {
      overflow-y: auto;
      /* Preserve the expanded scrollbar gutter while hiding its paint. A
       * width change here can wrap row content and change every later offset. */
      scrollbar-color: transparent transparent;
    }

    .session-turn-list::-webkit-scrollbar-thumb,
    .session-turn-list::-webkit-scrollbar-track,
    [data-testid="session-trace-row-list"]::-webkit-scrollbar-thumb,
    [data-testid="session-trace-row-list"]::-webkit-scrollbar-track {
      background: transparent;
    }

    .session-view-control__expanded {
      display: none;
    }

    .session-view-control__compact {
      display: flex;
    }

    .session-navigation-annotation-row__expanded-content {
      display: none;
    }

    .session-turn-row__compact-index,
    .session-trace-row-header__compact-index,
    .trace-summary-row__compact-index {
      position: absolute;
      top: var(--global-session-details-navigation-top-level-row-padding-block);
      left: var(
        --global-details-panel-navigation-row-content-padding-inline-start
      );
      z-index: var(--global-z-index-local-raised);
      display: inline-flex;
      justify-content: flex-start;
      width: var(--global-dimension-size-200);
      text-align: left;
    }

    .session-turn-row__expanded-content,
    .session-trace-row-header__expanded-content,
    .session-trace-row-chevron,
    .trace-summary-row__expanded-content,
    .trace-summary-row__disclosure {
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
      /* A real border consumes 1px at the top and bottom of this border-box.
       * Paint the hover edge outside the box so its children keep the exact
       * same available height as the resting and expanded navigation. */
      border: 0;
      outline: var(--global-border-size-thin) solid
        var(--global-border-color-default);
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
  const { focusProps, isFocusVisible } = useFocusRing({ within: true });
  const isOpen = isCollapsed && (isPointerOpen || isFocusVisible);
  const navigationBody =
    typeof children === "function"
      ? children({ isOverlayOpen: isOpen })
      : children;

  return (
    <div
      className="session-details-navigation"
      css={sessionDetailsNavigationCSS}
      data-collapsed={isCollapsed}
      data-navigation-scrollbar="active"
      data-open={isOpen}
    >
      <div
        className="session-details-navigation__content"
        data-open={isOpen}
        onPointerLeave={() => onPointerOpenChange(false)}
      >
        {control}
        <div
          {...focusProps}
          className="session-details-navigation__body"
          onPointerEnter={() => onPointerOpenChange(true)}
        >
          {navigationBody}
        </div>
      </div>
    </div>
  );
}
