import { useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { Button, ExternalLink, Flex, Icon, Icons } from "@phoenix/components";
import { Shape, ShapeIcon } from "@phoenix/components/pointcloud";
import { FloatCell, TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { useInferences, usePointCloudContext } from "@phoenix/contexts";

import { ModelEvent } from "./types";
import { useDefaultColorScheme } from "./useDefaultColorScheme";

interface TableDataItem extends ModelEvent {
  metric?: number | null;
}
/**
 * Lists the points that have been selected in the point cloud
 */
export function PointSelectionTable({
  data,
  onPointSelected,
}: {
  data: ModelEvent[];
  onPointSelected: (pointId: string) => void;
}) {
  const { primaryInferences, referenceInferences } = useInferences();
  const metric = usePointCloudContext((state) => state.metric);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columns, tableData } = useMemo<{
    columns: ColumnDef<TableDataItem>[];
    tableData: TableDataItem[];
  }>(() => {
    // Corpus points cannot be shown under the  table as they don't contain data that is uniform nor data that is under analysis
    // TODO(mikeldking): show corpus points under a separate tab
    const tableData: TableDataItem[] = data.filter((point) => {
      return point.id.includes("CORPUS") === false;
    });
    let hasLinkToData = false,
      hasRawData = false,
      hasPromptAndResponse = false,
      hasPredictionLabels = false,
      hasActualLabels = false;
    data.forEach((point) => {
      if (point.linkToData) {
        hasLinkToData = true;
      }
      if (point.rawData) {
        hasRawData = true;
      }
      if (point.prompt || point.response) {
        hasPromptAndResponse = true;
      }
      if (point.predictionLabel) {
        hasPredictionLabels = true;
      }
      if (point.actualLabel) {
        hasActualLabels = true;
      }
    });

    // Show the data quality metric

    // Columns that are only visible if certain data is available
    const dataDrivenColumns: ColumnDef<TableDataItem>[] = [];
    if (referenceInferences) {
      // Only need to show the inferences if there are two
      dataDrivenColumns.push({
        header: "Inference Set",
        accessorKey: "id",
        size: 50,
        cell: ({ getValue }) => {
          return (
            <EventInferencesRoleCell
              id={getValue() as string}
              primaryInferencesName={primaryInferences.name}
              referenceInferencesName={referenceInferences?.name ?? "reference"}
            />
          );
        },
      });
    }
    if (hasLinkToData) {
      dataDrivenColumns.push({
        header: "Link",
        accessorKey: "linkToData",
        cell: ({ getValue }) => {
          const value = getValue();
          if (typeof value === "string") {
            const fileName = value.split("/").pop();
            return <ExternalLink href={value}>{fileName}</ExternalLink>;
          }
          return null;
        },
      });
    }
    if (hasPromptAndResponse) {
      dataDrivenColumns.push({
        header: "Prompt",
        accessorKey: "prompt",
        cell: TextCell,
        size: 200,
      });
      dataDrivenColumns.push({
        header: "Response",
        accessorKey: "response",
        cell: TextCell,
        size: 200,
      });
    } else if (hasRawData) {
      dataDrivenColumns.push({
        header: "Raw Data",
        accessorKey: "rawData",
      });
    }
    if (hasPredictionLabels) {
      dataDrivenColumns.push({
        header: "Prediction Label",
        accessorKey: "predictionLabel",
        size: 50,
      });
    }
    if (hasActualLabels) {
      dataDrivenColumns.push({
        header: "Actual Label",
        accessorKey: "actualLabel",
        size: 50,
      });
    }

    // If a dimension data quality metric is selected, show it
    const analysisColumns: ColumnDef<TableDataItem>[] = [];
    if (metric && metric.type === "dataQuality") {
      const dimensionName = metric.dimension.name;
      analysisColumns.push({
        header: metric.dimension.name,
        accessorKey: "metric",
        cell: FloatCell,
        sortingFn: "basic",
      });

      // Add the metric name to the table value
      tableData.forEach((dataItem) => {
        const metricValue = dataItem.dimensions.find(
          (dimension) => dimension.dimension.name === dimensionName
        )?.value;
        dataItem.metric = metricValue != null ? Number(metricValue) : null;
      });
    }

    const columns: ColumnDef<TableDataItem>[] = [
      ...dataDrivenColumns,
      ...analysisColumns,
      {
        header: "",
        id: "view-details",
        size: 50,
        cell: ({ row }) => {
          return (
            <Button
              aria-label="view point details"
              size="S"
              onPress={() => {
                onPointSelected(row.original.id);
              }}
            >
              view details
            </Button>
          );
        },
      },
    ];
    return { columns, tableData };
  }, [data, onPointSelected, primaryInferences, referenceInferences, metric]);

  const table = useReactTable<TableDataItem>({
    columns,
    data: tableData,
    state: {
      sorting,
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table css={tableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  <div
                    {...{
                      className: header.column.getCanSort()
                        ? "cursor-pointer"
                        : "",
                      onClick: header.column.getToggleSortingHandler(),
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
                            <Icons.ArrowDownFilled />
                          ) : (
                            <Icons.ArrowUpFilled />
                          )
                        }
                      />
                    ) : null}
                  </div>
                )}
                <div
                  {...{
                    onMouseDown: header.getResizeHandler(),
                    onTouchStart: header.getResizeHandler(),
                    className: `resizer ${
                      header.column.getIsResizing() ? "isResizing" : ""
                    }`,
                    style: {
                      transform: header.column.getIsResizing()
                        ? `translateX(${
                            table.getState().columnSizingInfo.deltaOffset
                          }px)`
                        : "",
                    },
                  }}
                />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
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
    </table>
  );
}

function EventInferencesRoleCell({
  id,
  primaryInferencesName,
  referenceInferencesName,
}: {
  id: string;
  primaryInferencesName: string;
  referenceInferencesName: string;
}) {
  const isPrimary = id.includes("PRIMARY");
  const DEFAULT_COLOR_SCHEME = useDefaultColorScheme();
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <ShapeIcon
        shape={Shape.circle}
        color={DEFAULT_COLOR_SCHEME[isPrimary ? 0 : 1]}
      />
      {isPrimary ? primaryInferencesName : referenceInferencesName}
    </Flex>
  );
}
