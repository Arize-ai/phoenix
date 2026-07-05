import { css } from "@emotion/react";
import { startTransition, useEffect, useState } from "react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Input,
  SearchField,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { useTraceTree } from "./TraceTreeContext";
import { COMPACT_BREAKPOINT } from "./traceTreeStyles";

const TRACE_TREE_SEARCH_DEBOUNCE_MS = 200;

export function TraceTreeToolbar() {
  const [searchValue, setSearchValue] = useState("");
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const setShowMetricsInTraceTree = usePreferencesContext(
    (state) => state.setShowMetricsInTraceTree
  );
  const { isCollapsed, setIsCollapsed, setSearchQuery } = useTraceTree();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setSearchQuery(searchValue.trim());
      });
    }, TRACE_TREE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue, setSearchQuery]);

  return (
    <div
      className="trace-tree-toolbar"
      css={css`
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        box-sizing: border-box;
        width: 100%;
        align-items: center;
        padding: var(--global-dimension-size-100);
        border-bottom: 1px solid var(--global-color-gray-300);
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
          padding-left: var(--global-dimension-static-size-100) !important;
          padding-right: var(--global-dimension-static-size-300) !important;
          color: var(--global-text-color-900);
          font-size: var(--global-font-size-s);
          line-height: var(--global-line-height-s);
        }
        .trace-tree-toolbar__search .react-aria-Input::placeholder {
          color: var(--global-text-color-700);
          font-style: normal;
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
          <SearchField
            aria-label="Search trace tree"
            onChange={setSearchValue}
            value={searchValue}
            variant="quiet"
          >
            <Input placeholder="Search trace" />
          </SearchField>
        </div>
        <Flex direction="row" gap="size-100" className="trace-tree-controls">
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={isCollapsed ? "Expand all" : "Collapse all"}
              onPress={() => {
                startTransition(() => {
                  setIsCollapsed(!isCollapsed);
                });
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
