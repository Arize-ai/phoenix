import React, { PropsWithChildren, useMemo } from "react";
import { Column, useTable } from "react-table";
import { css } from "@emotion/react";

import { Accordion, AccordionItem } from "@arizeai/components";

import { Empty } from "@phoenix/components/Empty";
import { tableCSS } from "@phoenix/components/table/styles";

import { ModelEvent } from "./types";

function TextPre(props: PropsWithChildren) {
  return (
    <div
      css={css`
        max-height: 200px;
        overflow-y: auto;
      `}
    >
      <pre
        css={(theme) => css`
          padding: var(--px-spacing-lg);
          background-color: ${theme.colors.gray900};
          color: ${theme.textColors.white90};
          white-space: normal;
          margin: 0;
        `}
      >
        {props.children}
      </pre>
    </div>
  );
}
/**
 * Displays the details of an event in a slide over panel
 */
export function EventDetails({ event }: { event: ModelEvent }) {
  const imageUrl = event.linkToData || undefined;
  const promptAndResponse: PromptResponse | null =
    event.prompt || event.response
      ? { prompt: event.prompt, response: event.response }
      : null;
  return (
    <section
      css={css`
        height: 100%;
        overflow-y: auto;
      `}
    >
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
      {event.rawData ? <TextPre>{event.rawData}</TextPre> : null}
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
        {promptAndResponse ? (
          <AccordionItem id="prompt" title="Prompt">
            <TextPre>{promptAndResponse.prompt}</TextPre>
          </AccordionItem>
        ) : null}
        {promptAndResponse ? (
          <AccordionItem id="response" title="Response">
            <TextPre>{promptAndResponse.response}</TextPre>
          </AccordionItem>
        ) : null}
        <AccordionItem id="dimensions" title="Dimensions">
          <EmbeddingDimensionsTable dimensions={event.dimensions} />
        </AccordionItem>
      </Accordion>
    </section>
  );
}

/**
 * A row of data to show in the table
 */
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
        value: dimension.value ?? "--",
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
      {rows.length ? (
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
      ) : (
        <TableEmpty />
      )}
    </table>
  );
}

function TableEmpty() {
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={(theme) => css`
            text-align: center;
            padding: ${theme.spacing.margin24}px ${theme.spacing.margin24}px !important;
          `}
        >
          <Empty
            graphicKey="documents"
            message="This embedding has no associated dimensions"
          />
        </td>
      </tr>
    </tbody>
  );
}
