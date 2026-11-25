import type {
  OnChangeFn,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import { Icon, Icons, Link, Text } from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { DatasetLink } from "@phoenix/components/dataset/DatasetLink";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { EvaluatorSelectionToolbar } from "@phoenix/components/evaluators/EvaluatorSelectionToolbar";
import { ProjectLink } from "@phoenix/components/project/ProjectLink";
import {
  CHECKBOX_COLUMN_ID,
  createRowSelectionColumn,
  useShiftClickRowSelection,
} from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableColumnHeader } from "@phoenix/components/table/TableColumnHeader";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import type { AllEvaluatorsTableQuery } from "@phoenix/pages/evaluators/all/__generated__/AllEvaluatorsTableQuery.graphql";
import { DeleteAllEvaluatorsDialog } from "@phoenix/pages/evaluators/all/DeleteAllEvaluatorsDialog";
import { GlobalEvaluatorsEmptyState } from "@phoenix/pages/evaluators/GlobalEvaluatorsEmptyState";
import { ProjectEvaluatorStatusCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStatusCell";

type QueryData = AllEvaluatorsTableQuery["response"];
type ProjectEvaluatorNode =
  QueryData["projectEvaluators"]["edges"][number]["node"];

/**
 * Up to this many of each type are loaded, newest first, the same cap as the
 * Project evaluators tab. Sorting and search happen here, over those rows.
 */
const EVALUATORS_LIMIT = 1000;

export const ALL_EVALUATORS_DEFAULT_SORTING: SortingState = [
  { id: "createdAt", desc: true },
];

type TableRow = {
  id: string;
  name: string;
  kind: QueryData["datasetEvaluators"]["edges"][number]["node"]["evaluator"]["kind"];
  createdAt: string;
  updatedAt: string;
  detailsPath: string;
  attachedTo: {
    type: "project" | "dataset";
    name: string;
    path: string;
  };
  runSummary: ProjectEvaluatorNode["runSummary"] | null;
};

const columns: ColumnDef<TableRow>[] = [
  {
    id: "kind",
    header: "kind",
    size: 80,
    accessorFn: (row) => row.kind,
    cell: ({ row }) => <EvaluatorKindToken kind={row.original.kind} />,
  },
  {
    id: "name",
    header: "name",
    size: 220,
    accessorFn: (row) => row.name,
    cell: ({ row }) => (
      <Link to={row.original.detailsPath}>
        <Truncate maxWidth="100%">{row.original.name}</Truncate>
      </Link>
    ),
  },
  {
    id: "attachedTo",
    header: "attached to",
    size: 220,
    accessorFn: (row) => row.attachedTo.name,
    cell: ({ row }) => {
      const { type, name, path } = row.original.attachedTo;
      return type === "project" ? (
        <ProjectLink name={name} to={path} />
      ) : (
        <DatasetLink name={name} to={path} />
      );
    },
  },
  {
    id: "status",
    header: "status",
    size: 120,
    accessorFn: (row) => row.runSummary?.status ?? "",
    cell: ({ row }) =>
      row.original.runSummary ? (
        <ProjectEvaluatorStatusCell runSummary={row.original.runSummary} />
      ) : (
        <Text color="text-700">--</Text>
      ),
  },
  {
    id: "createdAt",
    header: "created",
    size: 180,
    accessorFn: (row) => row.createdAt,
    // ISO 8601 UTC timestamps sort chronologically as text.
    sortFn: "text",
    sortDescFirst: true,
    cell: TimestampCell,
  },
  {
    id: "updatedAt",
    header: "last updated",
    size: 180,
    accessorFn: (row) => row.updatedAt,
    sortFn: "text",
    sortDescFirst: true,
    cell: TimestampCell,
  },
];

/**
 * Every project evaluator and every dataset evaluator on the server, in one
 * list.
 */
export function AllEvaluatorsTable({
  filter,
  sorting,
  onSortingChange,
}: {
  filter: string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  const navigate = useNavigate();
  const [fetchKey, setFetchKey] = useState(0);
  const refetch = () => setFetchKey((key) => key + 1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const data = useLazyLoadQuery<AllEvaluatorsTableQuery>(
    graphql`
      query AllEvaluatorsTableQuery($first: Int!) {
        projectEvaluators(first: $first) {
          edges {
            node {
              id
              name
              createdAt
              updatedAt
              project {
                id
                name
              }
              evaluator {
                kind
              }
              runSummary {
                status
                lastRunAt
                queuedCount
                evaluatedCount
                failedCount
                clearedCount
                oldestWaitingOrRetryingAt
              }
            }
          }
        }
        datasetEvaluators(first: $first, sort: { col: createdAt, dir: desc }) {
          edges {
            node {
              id
              name
              createdAt
              updatedAt
              dataset {
                id
                name
              }
              evaluator {
                kind
              }
            }
          }
        }
      }
    `,
    { first: EVALUATORS_LIMIT },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const projectRows: TableRow[] = data.projectEvaluators.edges.map(
    ({ node }) => {
      const projectPath = `/projects/${encodeURIComponent(node.project.id)}/evaluators`;
      return {
        id: node.id,
        name: node.name,
        kind: node.evaluator.kind,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        detailsPath: `${projectPath}/${encodeURIComponent(node.id)}`,
        attachedTo: {
          type: "project",
          name: node.project.name,
          path: projectPath,
        },
        runSummary: node.runSummary,
      };
    }
  );
  const datasetRows: TableRow[] = data.datasetEvaluators.edges.map(
    ({ node }) => ({
      id: node.id,
      name: node.name,
      kind: node.evaluator.kind,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      detailsPath: `/datasets/${node.dataset.id}/evaluators/${node.id}`,
      attachedTo: {
        type: "dataset",
        name: node.dataset.name,
        path: `/datasets/${node.dataset.id}`,
      },
      runSummary: null,
    })
  );
  const trimmedFilter = filter.trim().toLowerCase();
  const rows = [...projectRows, ...datasetRows].filter(
    (row) =>
      trimmedFilter.length === 0 ||
      row.name.toLowerCase().includes(trimmedFilter) ||
      row.attachedTo.name.toLowerCase().includes(trimmedFilter)
  );
  // Only shown rows count, so a search that hides a selected row also keeps
  // it out of a delete.
  const selectedRows = rows.filter((row) => rowSelection[row.id]);
  const toEvaluatorToDelete = (row: TableRow) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
  });
  const { selectRow } = useShiftClickRowSelection<TableRow>({
    resetKey: data,
  });
  const table = useTable({
    features: appTableFeatures,
    data: rows,
    columns: [createRowSelectionColumn<TableRow>({ selectRow }), ...columns],
    state: { sorting, rowSelection },
    onSortingChange,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
  });
  const tableRows = table.getRowModel().rows;
  if (projectRows.length === 0 && datasetRows.length === 0) {
    return <GlobalEvaluatorsEmptyState hasActiveFilter={false} />;
  }
  return (
    <>
      <table
        css={selectableTableCSS}
        aria-label="Project and dataset evaluators"
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableColumnHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        {tableRows.length === 0 ? (
          <TableEmptyWrap>
            <CompactEmptyState
              icon={<Icon svg={<Icons.Scale />} />}
              description="No evaluators"
              isFiltered={trimmedFilter.length > 0}
            />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {tableRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => navigate(row.original.detailsPath)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      maxWidth: cell.column.getSize(),
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      userSelect:
                        cell.column.id === CHECKBOX_COLUMN_ID
                          ? "none"
                          : undefined,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {selectedRows.length > 0 ? (
        <>
          <EvaluatorSelectionToolbar
            selectedCount={selectedRows.length}
            onClearSelection={() => setRowSelection({})}
            onDelete={() => setIsDeleteDialogOpen(true)}
          />
          <DeleteAllEvaluatorsDialog
            projectEvaluators={selectedRows
              .filter((row) => row.attachedTo.type === "project")
              .map(toEvaluatorToDelete)}
            datasetEvaluators={selectedRows
              .filter((row) => row.attachedTo.type === "dataset")
              .map(toEvaluatorToDelete)}
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onDeleted={() => {
              setRowSelection({});
              refetch();
            }}
            onPartiallyDeleted={refetch}
          />
        </>
      ) : null}
    </>
  );
}
