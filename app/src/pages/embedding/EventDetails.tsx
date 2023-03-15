import React, { useMemo } from "react";
import { Column, useTable } from "react-table";
import { css } from "@emotion/react";

import { Accordion, AccordionItem } from "@arizeai/components";

import { tableCSS } from "@phoenix/components/table/styles";

import { ModelEvent } from "./types";

/**
 * Displays the details of an event in a slide over panel
 */
export function EventDetails({ event }: { event: ModelEvent }) {
  const imageUrl = event.linkToData || undefined;
  return (
    <section>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="event image"
          width="100%"
          height="200px"
          css={css`
            object-fit: contain;
            background-color: black;
          `}
        />
      ) : null}
      {event.rawData ? (
        <pre
          css={(theme) => css`
            padding: var(--px-spacing-lg);
            background-color: ${theme.colors.gray900};
            color: ${theme.textColors.white90};
            white-space: normal;
            margin: 0;
          `}
        >
          {event.rawData}
        </pre>
      ) : null}
      <Accordion variant="compact">
        <AccordionItem id="prediction" title="Prediction Details">
          <dl
            css={css`
              margin: var(--px-spacing-lg);
              display: flex;
              flex-direction: column;
              gap: var(--px-spacing-med);
              & > div {
                display: flex;
                flex-direction: row;
                dt {
                  font-weight: bold;
                  flex: none;
                  width: 120px;
                }
                dd {
                  flex: 1 1 auto;
                  margin-inline-start: 0;
                }
              }
            `}
          >
            {/* {prediction.predictionId != null && (
              <div>
                <dt>Prediction ID</dt>
                <dd
                  css={css`
                    display: flex;
                    align-items: center;
                  `}
                >
                  {prediction.predictionId}
                </dd>
              </div>
            )} */}
            {event.predictionLabel != null && (
              <div>
                <dt>Prediction Label</dt>
                <dd>{event.predictionLabel}</dd>
              </div>
            )}
            {/* {prediction.predictionScore != null && (
              <div>
                <dt>Prediction Score</dt>
                <dd>{prediction.predictionScore}</dd>
              </div>
            )} */}
            {event.actualLabel != null && (
              <div>
                <dt>Actual Label</dt>
                <dd>{event.actualLabel}</dd>
              </div>
            )}
            {/* {prediction.actualScore != null && (
              <div>
                <dt>Actual Score</dt>
                <dd>{prediction.actualScore}</dd>
              </div>
            )} */}
          </dl>
        </AccordionItem>
        <AccordionItem id="dimensions" title="Dimensions">
          <EmbeddingDimensionsTable dimensions={event.dimensions} />
        </AccordionItem>
      </Accordion>
    </section>
  );
}

type DimensionRow = {
  name: string;
  type: string;
  value: string;
};

function EmbeddingDimensionsTable({
  dimensions,
}: {
  dimensions: ModelEvent["dimensions"];
}) {
  const data: DimensionRow[] = useMemo(() => {
    return dimensions.map((dimension) => {
      return {
        name: dimension.dimension.name,
        type: dimension.dimension.type,
        value: dimension.value,
      };
    });
  }, [dimensions]);

  const columns: Column<DimensionRow>[] = useMemo(
    () => [
      {
        Header: "Name",
        accessor: "name",
      },
      {
        Header: "Data Type",
        accessor: "type",
      },
      {
        Header: "Value",
        accessor: "value",
      },
    ],
    []
  );

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } =
    useTable<DimensionRow>({
      columns,
      data,
    });
  return (
    <table {...getTableProps()} css={tableCSS}>
      <thead>
        {headerGroups.map((headerGroup, idx) => (
          <tr {...headerGroup.getHeaderGroupProps()} key={idx}>
            {headerGroup.headers.map((column, idx) => (
              <th {...column.getHeaderProps()} key={idx}>
                {column.render("Header")}
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
