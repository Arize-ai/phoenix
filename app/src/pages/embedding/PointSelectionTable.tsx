import React, { useMemo } from "react";
import {
  CellProps,
  Column,
  useFlexLayout,
  useResizeColumns,
  useSortBy,
  useTable,
} from "react-table";

import { Icon, Icons } from "@arizeai/components";

import { ExternalLink, LinkButton } from "@phoenix/components";
import { FloatCell, TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { useDatasets, usePointCloudContext } from "@phoenix/contexts";

import { ModelEvent } from "./types";

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
  const { primaryDataset, referenceDataset } = useDatasets();
  const metric = usePointCloudContext((state) => state.metric);
  const { columns, tableData } = useMemo<{
    columns: Column<TableDataItem>[];
    tableData: TableDataItem[];
  }>(() => {
    const tableData: TableDataItem[] = [...data];
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
    const dataDrivenColumns: Column<TableDataItem>[] = [];
    if (referenceDataset) {
      // Only need to show the dataset if there are two
      dataDrivenColumns.push({
        Header: "Dataset",
        accessor: "id",
        width: 50,
        Cell: ({ value }: CellProps<TableDataItem>) => {
          return (
            <EventDatasetCell
              id={value}
              primaryDatasetName={primaryDataset.name}
              referenceDatasetName={referenceDataset?.name ?? "reference"}
            />
          );
        },
      });
    }
    if (hasLinkToData) {
      dataDrivenColumns.push({
        Header: "Link",
        accessor: "linkToData",
        Cell: ({ value }: CellProps<TableDataItem>) => {
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
        Header: "Prompt",
        accessor: "prompt",
        width: 200,
        Cell: TextCell,
      });
      dataDrivenColumns.push({
        Header: "Response",
        accessor: "response",
        width: 200,
        Cell: TextCell,
      });
    } else if (hasRawData) {
      dataDrivenColumns.push({
        Header: "Raw Data",
        accessor: "rawData",
        width: 200,
      });
    }
    if (hasPredictionLabels) {
      dataDrivenColumns.push({
        Header: "Prediction Label",
        accessor: "predictionLabel",
        width: 50,
      });
    }
    if (hasActualLabels) {
      dataDrivenColumns.push({
        Header: "Actual Label",
        accessor: "actualLabel",
        width: 50,
      });
    }

    // If a dimension data quality metric is selected, show it
    const analysisColumns: Column<TableDataItem>[] = [];
    if (metric && metric.type === "dataQuality") {
      const dimensionName = metric.dimension.name;
      analysisColumns.push({
        Header: metric.dimension.name,
        accessor: "metric",
        width: 50,
        Cell: FloatCell,
        sortType: "basic",
      });

      // Add the metric name to the table value
      tableData.forEach((dataItem) => {
        const metricValue = dataItem.dimensions.find(
          (dimension) => dimension.dimension.name === dimensionName
        )?.value;
        dataItem.metric = metricValue != null ? Number(metricValue) : null;
      });
    }

    const columns: Column<TableDataItem>[] = [
      ...dataDrivenColumns,
      ...analysisColumns,
      {
        Header: "",
        id: "view-details",
        width: 50,
        Cell: ({ row }: CellProps<TableDataItem>) => {
          return (
            <LinkButton
              aria-label="view point details"
              onClick={() => {
                onPointSelected(row.original.id);
              }}
            >
              view details
            </LinkButton>
          );
        },
      },
    ];
    return { columns, tableData };
  }, [data, onPointSelected, primaryDataset, referenceDataset, metric]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } =
    useTable<TableDataItem>(
      {
        columns,
        data: tableData,
      },
      useFlexLayout,
      useResizeColumns,
      useSortBy
    );

  return (
    <table {...getTableProps()} css={tableCSS}>
      <thead>
        {headerGroups.map((headerGroup, idx) => (
          <tr {...headerGroup.getHeaderGroupProps()} key={idx}>
            {headerGroup.headers.map((column, idx) => (
              <th {...column.getHeaderProps()} key={idx}>
                <span {...column.getSortByToggleProps()}>
                  {column.render("Header")}
                  {column.isSorted ? (
                    <Icon
                      className="sort-icon"
                      svg={
                        column.isSortedDesc ? (
                          <Icons.ArrowDownFilled />
                        ) : (
                          <Icons.ArrowUpFilled />
                        )
                      }
                    />
                  ) : null}
                </span>

                {/* Use column.getResizerProps to hook up the events correctly */}
                {column.canResize && (
                  <div
                    {...column.getResizerProps()}
                    className={`resizer ${
                      column.isResizing ? "isResizing" : ""
                    }`}
                  />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, idx) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} key={idx}>
              {row.cells.map((cell, idx) => {
                return (
                  <td {...cell.getCellProps()} key={idx}>
                    {cell.render("Cell")}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EventDatasetCell({
  id,
  primaryDatasetName,
  referenceDatasetName,
}: {
  id: string;
  primaryDatasetName: string;
  referenceDatasetName: string;
}) {
  return (
    <span>
      {id.includes("PRIMARY") ? primaryDatasetName : referenceDatasetName}
    </span>
  );
}
