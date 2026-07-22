import { css } from "@emotion/react";

import {
  DebouncedSearch,
  Flex,
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { useTraceTree } from "./TraceTreeContext";
import { COMPACT_BREAKPOINT } from "./traceTreeStyles";

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
        flex-direction: row;
        justify-content: space-between;
        box-sizing: border-box;
        width: 100%;
        flex: none;
        align-items: center;
        padding: var(--global-dimension-size-100);
        border-bottom: 1px solid var(--global-border-color-default);
        height: var(--global-dimension-size-600);
        @container (width < ${COMPACT_BREAKPOINT}) {
          button {
            display: none;
          }
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
          font-size: var(--global-font-size-l);
        }
        .trace-tree-toolbar__search .search-field__icon ~ .react-aria-Input {
          padding-left: calc(
            var(--global-dimension-size-200) + var(--global-font-size-l)
          ) !important;
        }
      `}
    >
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flex="none"
        gap="size-100"
        width="100%"
      >
        <div className="trace-tree-toolbar__search">
          <DebouncedSearch
            aria-label="Search trace tree"
            defaultValue={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search trace"
            variant="quiet"
          />
        </div>
        <Flex direction="row" gap="size-100" className="trace-tree-controls">
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={isCollapsed ? "Expand all" : "Collapse all"}
              onPress={() => {
                setIsCollapsed(!isCollapsed);
              }}
            >
              <Icon
                svg={isCollapsed ? <Icons.RowCollapse /> : <Icons.RowExpand />}
              />
            </IconButton>
            <Tooltip offset={-5}>
              {isCollapsed
                ? "Expand all nested spans"
                : "Collapse all nested spans"}
            </Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <IconButton
              size="S"
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
            </IconButton>
            <Tooltip offset={-5}>
              {showMetricsInTraceTree
                ? "Hide metrics in trace tree"
                : "Show metrics in trace tree"}
            </Tooltip>
          </TooltipTrigger>
        </Flex>
      </Flex>
    </div>
  );
}
