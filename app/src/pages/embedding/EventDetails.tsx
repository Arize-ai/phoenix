import React, { PropsWithChildren, useMemo } from "react";
import { Column, useTable } from "react-table";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  Flex,
  Heading,
  Label,
  Text,
  View,
} from "@arizeai/components";

import { Empty } from "@phoenix/components/Empty";
import { tableCSS } from "@phoenix/components/table/styles";
import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { ModelEvent, RetrievalDocument } from "./types";

const detailsListCSS = css`
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
`;

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
  const hasRetrievals =
    event.retrievedDocuments && event.retrievedDocuments.length > 0;
  const isPredictionRecord = !event.id.includes("CORPUS");
  return (
    <section
      css={css`
        height: 100%;
        overflow-y: auto;
      `}
    >
      <EventPreview event={event} />
      <Accordion variant="compact">
        {isPredictionRecord ? (
          <AccordionItem id="prediction" title={"Prediction Details"}>
            <dl css={detailsListCSS}>
              {event.predictionId != null && (
                <div>
                  <dt>Prediction ID</dt>
                  <dd
                    css={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    {event.predictionId}
                  </dd>
                </div>
              )}
              {event.predictionLabel != null && (
                <div>
                  <dt>Prediction Label</dt>
                  <dd>{event.predictionLabel}</dd>
                </div>
              )}
              {event.predictionScore != null && (
                <div>
                  <dt>Prediction Score</dt>
                  <dd>{event.predictionScore}</dd>
                </div>
              )}
              {event.actualLabel != null && (
                <div>
                  <dt>Actual Label</dt>
                  <dd>{event.actualLabel}</dd>
                </div>
              )}
              {event.actualScore != null && (
                <div>
                  <dt>Actual Score</dt>
                  <dd>{event.actualScore}</dd>
                </div>
              )}
            </dl>
          </AccordionItem>
        ) : (
          <AccordionItem id="document" title={"Document Details"}>
            {event.predictionId != null && (
              <div>
                <dt>Document ID</dt>
                <dd
                  css={css`
                    display: flex;
                    align-items: center;
                  `}
                >
                  {/* TODO - find a way to make the ID more semantic like a record ID */}
                  {event.predictionId}
                </dd>
              </div>
            )}
          </AccordionItem>
        )}
        <AccordionItem id="dimensions" title="Dimensions">
          <EmbeddingDimensionsTable dimensions={event.dimensions} />
        </AccordionItem>
        {hasRetrievals && (
          <AccordionItem
            id="retrievals"
            title="Retrieved Documents"
            // TODO(mikeldking) - add enough contrast to make this work
            // titleExtra={<Counter>{event.retrievedDocuments.length}</Counter>}
          >
            <ul
              css={css`
                padding: var(--px-spacing-med);
                li + li {
                  margin-top: var(--px-spacing-med);
                }
              `}
            >
              {event.retrievedDocuments.map((document) => {
                return (
                  <li key={document.id}>
                    <DocumentItem document={document} />
                  </li>
                );
              })}
            </ul>
          </AccordionItem>
        )}
      </Accordion>
    </section>
  );
}

function DocumentItem({ document }: { document: RetrievalDocument }) {
  return (
    <View borderRadius="medium" backgroundColor="light">
      <Flex direction="column">
        <View width="100%" borderBottomWidth="thin" borderBottomColor="dark">
          <Flex
            direction="row"
            justifyContent="space-between"
            margin="size-100"
            alignItems="center"
          >
            <Heading level={5}>Document {document.id}</Heading>
            <Label color="blue">{`relevance ${numberFormatter(
              document.relevance
            )}`}</Label>
          </Flex>
        </View>
        <pre
          css={css`
            padding: var(--px-spacing-lg);
            white-space: normal;
            margin: 0;
          `}
        >
          {document.text}
        </pre>
      </Flex>
    </View>
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
        Header: "Type",
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

/**
 * Renders a top-level preview of the event
 */
function EventPreview({ event }: { event: ModelEvent }) {
  const imageUrl = event.linkToData || undefined;
  const promptAndResponse: PromptResponse | null =
    event.prompt || event.response
      ? { prompt: event.prompt, response: event.response }
      : null;
  let content = null;
  if (imageUrl) {
    content = (
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
    );
  } else if (promptAndResponse) {
    content = (
      <Accordion variant="compact">
        <AccordionItem id="prompt" title="Prompt">
          <TextPre>{promptAndResponse.prompt}</TextPre>
        </AccordionItem>
        <AccordionItem id="response" title="Response">
          <TextPre>{promptAndResponse.response}</TextPre>
        </AccordionItem>
      </Accordion>
    );
  } else if (event.rawData) {
    {
      event.rawData ? <TextPre>{event.rawData}</TextPre> : null;
    }
  }
  return content;
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
