import { css } from "@emotion/react";

import {
  Button,
  DebouncedSearch,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import {
  TRACE_TREE_HOVER_WIDTH_PIXELS,
  TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS,
} from "@phoenix/constants";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { useTraceTree } from "./TraceTreeContext";

/**
 * Header controls for the trace tree panel.
 *
 * @remarks
 * Search input debouncing is delegated to `DebouncedSearch`, while transition
 * policy for filtering and global collapse/expand is owned by
 * `TraceTreeProvider`. Keeping those concerns out of the toolbar keeps this
 * component focused on layout and control wiring.
 */
export function TraceTreeToolbar() {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const setShowMetricsInTraceTree = usePreferencesContext(
    (state) => state.setShowMetricsInTraceTree
  );
  const { isCollapsed, searchQuery, setIsCollapsed, setSearchQuery } =
    useTraceTree();

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
          padding-right: var(--global-dimension-size-300) !important;
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

        .trace-tree-toolbar__action-label {
          display: none;
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

          .trace-tree-toolbar__search .search-field__clear {
            display: none;
          }
        }

        @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
          height: auto;

          .trace-tree-toolbar__layout,
          .trace-tree-toolbar__controls {
            flex-direction: column;
          }
        }
      `}
    >
      <div className="trace-tree-toolbar__layout">
        <div className="trace-tree-toolbar__search">
          <DebouncedSearch
            aria-label="Search trace tree"
            defaultValue={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search"
            size="S"
            variant="quiet"
          />
        </div>
        <div className="trace-tree-toolbar__controls">
          <TooltipTrigger>
            <Button
              className="trace-tree-toolbar__action"
              size="S"
              variant="quiet"
              aria-label={isCollapsed ? "Expand all" : "Collapse all"}
              onPress={() => {
                setIsCollapsed(!isCollapsed);
              }}
            >
              <Icon
                svg={isCollapsed ? <Icons.RowCollapse /> : <Icons.RowExpand />}
              />
              <span className="trace-tree-toolbar__action-label">
                {isCollapsed ? "Expand all" : "Collapse all"}
              </span>
            </Button>
            <Tooltip offset={-5}>
              {isCollapsed
                ? "Expand all nested spans"
                : "Collapse all nested spans"}
            </Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button
              className="trace-tree-toolbar__action"
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
                svg={
                  showMetricsInTraceTree ? <Icons.Timer /> : <Icons.TimerOff />
                }
              />
              <span className="trace-tree-toolbar__action-label">
                {showMetricsInTraceTree ? "Hide timing" : "Show timing"}
              </span>
            </Button>
            <Tooltip offset={-5}>
              {showMetricsInTraceTree
                ? "Hide metrics in trace tree"
                : "Show metrics in trace tree"}
            </Tooltip>
          </TooltipTrigger>
        </div>
      </div>
    </div>
  );
}
