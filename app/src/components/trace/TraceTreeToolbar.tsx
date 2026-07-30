import { css } from "@emotion/react";

import {
  Button,
  DebouncedSearch,
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import {
  TRACE_TREE_HOVER_WIDTH_PIXELS,
  TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS,
} from "@phoenix/constants";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { ExpandCollapseAllButton } from "./ExpandCollapseAllButton";
import { useTraceTree } from "./TraceTreeContext";
import { TraceTreePanelToggleButton } from "./TraceTreePanelToggleButton";

export function TraceTreeTimingToggleButton({
  className,
}: {
  className?: string;
}) {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const setShowMetricsInTraceTree = usePreferencesContext(
    (state) => state.setShowMetricsInTraceTree
  );

  return (
    <TooltipTrigger>
      <Button
        className={className}
        size="S"
        variant="quiet"
        aria-label={
          showMetricsInTraceTree
            ? "Hide metrics in trace tree"
            : "Show metrics in trace tree"
        }
        onPress={() => {
          setShowMetricsInTraceTree(!showMetricsInTraceTree);
        }}
      >
        <Icon
          svg={showMetricsInTraceTree ? <Icons.Timer /> : <Icons.TimerOff />}
        />
      </Button>
      <Tooltip offset={-5}>
        {showMetricsInTraceTree
          ? "Hide metrics in trace tree"
          : "Show metrics in trace tree"}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Header controls for the trace tree panel.
 *
 * @remarks
 * Search input debouncing is delegated to `DebouncedSearch`, while transition
 * policy for filtering and global collapse/expand is owned by
 * `TraceTreeProvider`. Keeping those concerns out of the toolbar keeps this
 * component focused on layout and control wiring.
 */
export function TraceTreeToolbar({
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
}: {
  isTreePanelCollapsed?: boolean;
  onTreePanelCollapsedChange?: (isCollapsed: boolean) => void;
}) {
  const {
    hasErrors,
    isCollapsed,
    searchQuery,
    setIsCollapsed,
    setSearchQuery,
  } = useTraceTree();

  return (
    <div
      className="trace-tree-toolbar"
      css={css`
        display: flex;
        box-sizing: border-box;
        width: 100%;
        flex: none;
        padding: var(--global-dimension-size-100);
        border-bottom: 1px solid var(--global-border-color-default);
        height: var(--global-dimension-size-600);

        .trace-tree-toolbar__layout {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: var(--global-dimension-size-100);
          width: 100%;
        }

        .trace-tree-toolbar__search {
          flex: 1 1 auto;
          min-width: 0;
        }
        .trace-tree-toolbar__search .search-field {
          width: 100%;
        }
        .trace-tree-toolbar__search .react-aria-Input {
          min-width: 0;
          padding-left: var(--global-dimension-size-100) !important;
          padding-right: var(--global-button-height-s) !important;
          color: var(--global-text-color-900);
          font-size: var(--global-font-size-s);
          line-height: var(--global-line-height-s);
        }
        .trace-tree-toolbar__search .react-aria-Input::placeholder {
          color: var(--global-text-color-700);
          font-style: normal;
        }
        .trace-tree-toolbar__search .search-field__icon {
          left: var(--global-dimension-size-100);
          color: var(--global-text-color-500);
          font-size: var(--searchfield-icon-size);
        }
        .trace-tree-toolbar__search .search-field__icon ~ .react-aria-Input {
          padding-left: calc(
            var(--global-dimension-size-200) + var(--searchfield-icon-size)
          ) !important;
        }

        .trace-tree-toolbar__error-search-shortcut {
          position: absolute;
          right: 0;
          top: 50%;
          z-index: 1;
          transform: translateY(-50%);
        }

        .trace-tree-toolbar__controls {
          display: flex;
          flex: none;
          flex-direction: row;
          gap: var(--global-dimension-size-100);
        }

        .trace-tree-toolbar__action {
          width: var(--global-button-height-s);
          padding: 0 !important;
        }

        @container trace-tree-panel (width < ${TRACE_TREE_HOVER_WIDTH_PIXELS}px) {
          .trace-tree-toolbar__search {
            flex: none;
            width: var(--global-button-height-s);
          }

          .trace-tree-toolbar__search .search-field {
            width: var(--global-button-height-s);
            height: var(--global-button-height-s);
          }

          .trace-tree-toolbar__search .react-aria-Input {
            width: var(--global-button-height-s);
            padding: 0 !important;
            opacity: 0;
            cursor: pointer;
          }

          .trace-tree-toolbar__search .search-field__icon {
            left: 50%;
            transform: translate(-50%, -50%);
          }

          .trace-tree-toolbar__search
            .search-field:has(
              .trace-tree-toolbar__error-search-shortcut,
              .search-field__clear:not([data-empty])
            )
            .search-field__icon {
            display: none;
          }

          .trace-tree-toolbar__search .search-field__clear:not([data-empty]),
          .trace-tree-toolbar__error-search-shortcut {
            right: 0;
            top: 0;
            width: var(--global-button-height-s);
            height: var(--global-button-height-s);
            transform: none;
          }
        }

        @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
          display: none;
        }
      `}
    >
      <div className="trace-tree-toolbar__layout">
        <div className="trace-tree-toolbar__search">
          <DebouncedSearch
            aria-label="Search trace tree"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search"
            size="S"
            variant="quiet"
          >
            {({ isEmpty }) =>
              isEmpty && hasErrors ? (
                <TooltipTrigger>
                  <IconButton
                    className="trace-tree-toolbar__error-search-shortcut"
                    size="S"
                    aria-label="Show error spans"
                    onPress={() => setSearchQuery("ERR")}
                  >
                    <Icon svg={<Icons.SearchAlert />} />
                  </IconButton>
                  <Tooltip offset={-5}>Show error spans</Tooltip>
                </TooltipTrigger>
              ) : null
            }
          </DebouncedSearch>
        </div>
        <div className="trace-tree-toolbar__controls">
          <ExpandCollapseAllButton
            className="trace-tree-toolbar__action"
            contentLabel="nested spans"
            isCollapsed={isCollapsed}
            onCollapsedChange={setIsCollapsed}
          />
          <TraceTreeTimingToggleButton className="trace-tree-toolbar__action" />
          {isTreePanelCollapsed !== undefined &&
          onTreePanelCollapsedChange != null ? (
            <TraceTreePanelToggleButton
              className="trace-tree-toolbar__action trace-tree-toolbar__panel-toggle"
              isCollapsed={isTreePanelCollapsed}
              onCollapsedChange={onTreePanelCollapsedChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
