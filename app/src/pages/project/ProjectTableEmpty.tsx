import { Flex } from "@phoenix/components/core/layout";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";

import type { FilterConditionWarning } from "./spanFilterValidation";

type ProjectTableEmptyProps = {
  /**
   * The record noun to name in the copy -- "trace" for the traces table,
   * "span" for the spans table. Defaults to "trace".
   */
  noun?: "trace" | "span";
  /**
   * True when a non-empty filter is currently applied. Distinguishes "nothing
   * here yet" (no filter) from "your filter matched nothing", which get very
   * different copy and actions.
   */
  hasActiveFilter?: boolean;
  /**
   * Advisory diagnostics for the applied filter, if any. When a valid filter
   * returns nothing *and* carries a warning (e.g. a bare identifier that
   * silently resolved to an attribute path), the empty state explains the
   * likely cause rather than leaving the user to guess.
   */
  warnings?: FilterConditionWarning[];
  /**
   * Clears the active filter. When provided, a "Clear filter" action is
   * offered so the user can recover in one click.
   */
  onClearFilter?: () => void;
};

/**
 * The empty state for the traces/spans tables. Filter-aware: an empty result
 * caused by a filter reads differently from a genuinely empty project, and a
 * filter that silently matched nothing because of an unrecognized field gets
 * the field diagnostics surfaced here too -- the one place the user is looking
 * when they wonder "why are there no rows?".
 */
export function ProjectTableEmpty({
  noun = "trace",
  hasActiveFilter = false,
  warnings = [],
  onClearFilter,
}: ProjectTableEmptyProps) {
  if (!hasActiveFilter) {
    return (
      <TableEmptyWrap>
        <EmptyState
          graphic={<EmptyStateGraphic variant="trace" />}
          description={`No ${noun}s found`}
        />
      </TableEmptyWrap>
    );
  }

  const hasWarnings = warnings.length > 0;
  const description = hasWarnings ? (
    <Flex direction="column" gap="size-100" alignItems="center">
      <span>{`No ${noun}s match this filter.`}</span>
      {warnings.map((warning, index) => (
        <span key={index}>{warning.message}</span>
      ))}
    </Flex>
  ) : (
    `No ${noun}s match this filter.`
  );

  return (
    <TableEmptyWrap>
      <EmptyState
        title={`No matching ${noun}s`}
        graphic={<EmptyStateGraphic variant="trace" />}
        description={description}
        action={
          onClearFilter
            ? {
                type: "strip",
                items: [
                  {
                    kind: "button",
                    variant: "default",
                    children: "Clear filter",
                    onPress: onClearFilter,
                  },
                ],
              }
            : undefined
        }
      />
    </TableEmptyWrap>
  );
}
