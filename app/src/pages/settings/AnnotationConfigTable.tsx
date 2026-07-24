import { css } from "@emotion/react";
import type {
  CellContext,
  ColumnDef,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Flex,
  Icon,
  Icons,
  Text,
  Token,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { createRowSelectionColumn } from "@phoenix/components/table";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import type { AnnotationConfigTableFragment$key } from "@phoenix/pages/settings/__generated__/AnnotationConfigTableFragment.graphql";
import { AnnotationConfigSelectionToolbar } from "@phoenix/pages/settings/AnnotationConfigSelectionToolbar";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";

type PersistedAnnotationConfig = AnnotationConfig & { id: string };

const columns = [
  createRowSelectionColumn<PersistedAnnotationConfig>({
    size: 30,
    minSize: 30,
    maxSize: 30,
  }),
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: ({ row }: CellContext<PersistedAnnotationConfig, unknown>) => {
      return (
        <AnnotationLabel
          key={row.original.id}
          annotation={row.original}
          annotationDisplayPreference="none"
          css={css`
            width: fit-content;
          `}
        />
      );
    },
  },
  {
    id: "description",
    header: "Description",
    accessorKey: "description",
    sortUndefined: "last",
    accessorFn: (row: PersistedAnnotationConfig) =>
      row.description ?? undefined,
    maxSize: 150,
    cell: ({ row }: CellContext<PersistedAnnotationConfig, unknown>) => {
      return (
        <Truncate maxWidth="100%">
          <Text>{row.original.description}</Text>
        </Truncate>
      );
    },
  },
  {
    id: "annotationType",
    header: "Type",
    accessorKey: "annotationType",
    minSize: 10,
    cell: ({ row }: CellContext<PersistedAnnotationConfig, unknown>) => {
      return (
        <Text>
          {row.original.annotationType.charAt(0).toUpperCase() +
            row.original.annotationType.slice(1).toLowerCase()}
        </Text>
      );
    },
  },
  {
    id: "values",
    header: "Values",
    enableSorting: false,
    accessorFn: (row: PersistedAnnotationConfig) => {
      switch (row.annotationType) {
        case "CATEGORICAL": {
          if (!row.values) {
            return "";
          }
          let tokens = row.values.map(
            (value: { label: string }, index: number) => (
              <Token key={index} title={value.label}>
                <Truncate maxWidth="40px">{value.label}</Truncate>
              </Token>
            )
          );
          if (row.values.length > 5) {
            tokens = [
              ...tokens.slice(-4),
              <TooltipTrigger key="ellipsis" delay={64}>
                <TriggerWrap>
                  <Token
                    key="ellipsis"
                    css={css`
                      white-space: nowrap;
                    `}
                  >
                    + {row.values.length - 5} more
                  </Token>
                </TriggerWrap>
                <Tooltip placement="bottom right">
                  <TooltipArrow />
                  {row.values
                    .map((value: { label: string }) => value.label)
                    .join(", ")}
                </Tooltip>
              </TooltipTrigger>,
            ];
          }
          return tokens;
        }
        case "CONTINUOUS":
          return `from ${row.lowerBound} to ${row.upperBound}`;
        case "FREEFORM":
          return "";
        default:
          return "";
      }
    },
    cell: ({ getValue }: CellContext<PersistedAnnotationConfig, unknown>) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the accessorFn above returns a ReactNode but react-table types accessor values as unknown
      const value = getValue() as React.ReactNode;
      return <Flex gap="size-100">{value}</Flex>;
    },
  },
] satisfies ColumnDef<PersistedAnnotationConfig>[];

export const AnnotationConfigTable = ({
  annotationConfigs,
  onDeleteAnnotationConfig,
  onEditAnnotationConfig,
}: {
  annotationConfigs: AnnotationConfigTableFragment$key;
  onDeleteAnnotationConfig: (
    ids: string[],
    {
      onCompleted,
      onError,
    }?: { onCompleted?: () => void; onError?: (error: string) => void }
  ) => void;
  onEditAnnotationConfig: (
    annotationConfig: AnnotationConfig,
    {
      onCompleted,
      onError,
    }?: { onCompleted?: () => void; onError?: () => void }
  ) => void;
}) => {
  "use no memo";
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const data = useFragment(
    graphql`
      fragment AnnotationConfigTableFragment on Query {
        annotationConfigs {
          edges {
            annotationConfig: node {
              ... on CategoricalAnnotationConfig {
                id
                name
                description
                annotationType
                optimizationDirection
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                id
                name
                description
                annotationType
                optimizationDirection
                upperBound
                lowerBound
              }
              ... on FreeformAnnotationConfig {
                id
                name
                description
                annotationType
                optimizationDirection
                threshold
              }
            }
          }
        }
      }
    `,
    annotationConfigs
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fields are guaranteed by the concrete config fragments; Relay types inline-fragment fields as optional
  const configs = useMemo(
    () => data.annotationConfigs.edges.map((edge) => edge.annotationConfig),
    [data.annotationConfigs.edges]
  ) as PersistedAnnotationConfig[];
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    data: configs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      rowSelection,
      columnPinning: CHECKBOX_COLUMN_PINNING,
    },
  });
  const isEmpty = table.getRowCount() === 0;
  const rows = table.getRowModel().rows;

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedConfigs = selectedRows.map((row) => row.original);

  const clearSelection = () => {
    setRowSelection({});
  };

  return (
    <div
      css={css`
        overflow: auto;
      `}
    >
      <table
        css={tableCSS}
        style={{
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={getCommonPinningStyles(header.column)}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort() ? "sort" : "",
                        onClick: header.column.getToggleSortingHandler(),
                        style: {
                          left: header.getStart(),
                          width: header.getSize(),
                        },
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() ? (
                        <Icon
                          className="sort-icon"
                          svg={
                            header.column.getIsSorted() === "asc" ? (
                              <Icons.CaretUpFilled />
                            ) : (
                              <Icons.CaretDownFilled />
                            )
                          }
                        />
                      ) : null}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmptyWrap>
            <EmptyState
              graphic={<EmptyStateGraphic variant="config" />}
              description="No annotation configs"
            />
          </TableEmptyWrap>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      ...getCommonPinningStyles(cell.column),
                      width: cell.column.getSize(),
                      maxWidth: cell.column.getSize(),
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
        <AnnotationConfigSelectionToolbar
          selectedConfigs={selectedConfigs}
          onClearSelection={clearSelection}
          onEditAnnotationConfig={onEditAnnotationConfig}
          onDeleteAnnotationConfig={onDeleteAnnotationConfig}
        />
      ) : null}
    </div>
  );
};
