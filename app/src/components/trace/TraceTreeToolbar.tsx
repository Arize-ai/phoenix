import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { COMPACT_BREAKPOINT } from "./traceTreeStyles";
import { useTraceTree } from "./TraceTreeContext";

export function TraceTreeToolbar() {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const setShowMetricsInTraceTree = usePreferencesContext(
    (state) => state.setShowMetricsInTraceTree
  );
  const { isCollapsed, setIsCollapsed } = useTraceTree();
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
        <Heading level={3}>Trace</Heading>
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
                svg={
                  isCollapsed ? (
                    <Icons.RowCollapseOutline />
                  ) : (
                    <Icons.RowExpandOutline />
                  )
                }
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
                  showMetricsInTraceTree ? (
                    <Icons.TimerOutline />
                  ) : (
                    <Icons.TimerOffOutline />
                  )
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
