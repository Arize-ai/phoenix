import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";

export function ProjectTableEmpty() {
  return (
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="trace" />}
        description="No traces found that match the selected filters"
      />
    </TableEmptyWrap>
  );
}
