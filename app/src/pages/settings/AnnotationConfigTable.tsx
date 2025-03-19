import React, { ReactNode, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  Text,
  Token,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { AnnotationConfigDialog } from "@phoenix/pages/settings/AnnotationConfigDialog";
import { AnnotationConfig } from "@phoenix/pages/settings/SettingsAnnotationsPage";

const makeColumns = ({
  onEditAnnotationConfig,
}: {
  onEditAnnotationConfig: (annotationConfig: AnnotationConfig) => void;
}) =>
  [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => {
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
      id: "type",
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => {
        return (
          <Text>
            {row.original.type.charAt(0).toUpperCase() +
              row.original.type.slice(1)}
          </Text>
        );
      },
    },
    {
      id: "values",
      header: "Values",
      enableSorting: false,
      accessorFn: (row) => {
        switch (row.type) {
          case "categorical":
            return row.values.map((value, index) => (
              <Token key={index}>{value.label}</Token>
            ));
          case "continuous":
            return `Range: ${row.min} - ${row.max}`;
          case "text":
            return "";
          default:
            return "";
        }
      },
      cell: ({ getValue }) => {
        const value = getValue() as ReactNode;
        return <Flex gap="size-100">{value}</Flex>;
      },
    },
    {
      id: "actions",
      maxSize: 5,
      size: 5,
      cell: ({ row }) => {
        return (
          <Flex
            gap="size-100"
            justifyContent="center"
            flexShrink={1}
            width="100%"
          >
            <DialogTrigger>
              <Button size="S" variant="quiet">
                <Icon svg={<Icons.EditOutline />} />
              </Button>
              <Popover placement="bottom end">
                <PopoverArrow />
                <AnnotationConfigDialog
                  initialAnnotationConfig={row.original}
                  onAddAnnotationConfig={onEditAnnotationConfig}
                />
              </Popover>
            </DialogTrigger>
          </Flex>
        );
      },
    },
  ] satisfies ColumnDef<AnnotationConfig>[];

export const AnnotationConfigTable = ({
  annotationConfigs,
  onEditAnnotationConfig,
}: {
  annotationConfigs: AnnotationConfig[];
  onEditAnnotationConfig: (annotationConfig: AnnotationConfig) => void;
}) => {
  const columns = useMemo(
    () => makeColumns({ onEditAnnotationConfig }),
    [onEditAnnotationConfig]
  );
  const table = useReactTable({
    data: annotationConfigs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const isEmpty = table.getRowCount() === 0;
  const rows = table.getRowModel().rows;
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
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
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
    </div>
  );
};
