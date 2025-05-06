import React, { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Icon, Icons, Text, Token } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { AnnotationConfigTableFragment$key } from "@phoenix/pages/settings/__generated__/AnnotationConfigTableFragment.graphql";
import { AnnotationConfigSelectionToolbar } from "@phoenix/pages/settings/AnnotationConfigSelectionToolbar";
import { AnnotationConfig } from "@phoenix/pages/settings/types";

const columns = [
  {
    id: "select",
    maxSize: 10,
    header: () => null,
    cell: ({ row }: CellContext<AnnotationConfig, unknown>) => (
      <IndeterminateCheckboxCell
        {...{
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
          indeterminate: row.getIsSomeSelected(),
          onChange: row.getToggleSelectedHandler(),
        }}
      />
    ),
  },
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: ({ row }: CellContext<AnnotationConfig, unknown>) => {
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
    accessorFn: (row: AnnotationConfig) => row.description ?? undefined,
    maxSize: 150,
    cell: ({ row }: CellContext<AnnotationConfig, unknown>) => {
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
    cell: ({ row }: CellContext<AnnotationConfig, unknown>) => {
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
    accessorFn: (row: AnnotationConfig) => {
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
              <TooltipTrigger
                key="ellipsis"
                delay={64}
                placement="bottom right"
              >
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
                <Tooltip>
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
    cell: ({ getValue }: CellContext<AnnotationConfig, unknown>) => {
      const value = getValue() as React.ReactNode;
      return <Flex gap="size-100">{value}</Flex>;
    },
  },
] satisfies ColumnDef<AnnotationConfig>[];

export const AnnotationConfigTable = ({
  annotationConfigs,
  onDeleteAnnotationConfig,
  onEditAnnotationConfig,
}: {
  annotationConfigs: AnnotationConfigTableFragment$key;
  onDeleteAnnotationConfig: (
    id: string,
    {
      onCompleted,
      onError,
    }?: { onCompleted?: () => void; onError?: () => void }
  ) => void;
  onEditAnnotationConfig: (
    annotationConfig: AnnotationConfig,
    {
      onCompleted,
      onError,
    }?: { onCompleted?: () => void; onError?: () => void }
  ) => void;
}) => {
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
              }
            }
          }
        }
      }
    `,
    annotationConfigs
  );
  const configs = useMemo(
    () => data.annotationConfigs.edges.map((edge) => edge.annotationConfig),
    [data.annotationConfigs.edges]
  ) as AnnotationConfig[]; // cast to AnnotationConfig[] because otherwise 'name' and 'annotationType' are optional
  const table = useReactTable({
    data: configs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    enableMultiRowSelection: false,
    state: {
      rowSelection,
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
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort()
                          ? "cursor-pointer"
                          : "",
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
                              <Icons.ArrowUpFilled />
                            ) : (
                              <Icons.ArrowDownFilled />
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
          <TableEmpty message="No Annotation Configs" />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => {
                  setRowSelection({
                    [row.id]: !rowSelection?.[row.id],
                  });
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      maxWidth: cell.column.getSize(),
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
      {selectedRows.length > 0 && (
        <AnnotationConfigSelectionToolbar
          selectedConfig={selectedConfigs[0]}
          onClearSelection={clearSelection}
          onEditAnnotationConfig={onEditAnnotationConfig}
          onDeleteAnnotationConfig={onDeleteAnnotationConfig}
        />
      )}
    </div>
  );
};
