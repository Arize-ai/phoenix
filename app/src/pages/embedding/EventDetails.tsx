import React, { PropsWithChildren, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  Counter,
  Flex,
  Heading,
  Icon,
  Icons,
  Label,
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
      width: 130px;
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
          color: ${theme.textColors.text - 900};
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
      <Accordion>
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
            <dl css={detailsListCSS}>
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
            </dl>
          </AccordionItem>
        )}
        <AccordionItem id="dimensions" title="Dimensions">
          <EmbeddingDimensionsTable dimensions={event.dimensions} />
        </AccordionItem>
        {hasRetrievals && (
          <AccordionItem
            id="retrievals"
            title="Retrieved Documents"
            titleExtra={
              <Counter variant="light">
                {event.retrievedDocuments.length}
              </Counter>
            }
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
            <Flex direction="row" gap="size-50" alignItems="center">
              <Icon svg={<Icons.FileOutline />} />
              <Heading level={4}>document {document.id}</Heading>
            </Flex>
            {typeof document.relevance === "number" && (
              <Label color="blue">{`relevance ${numberFormatter(
                document.relevance
              )}`}</Label>
            )}
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

  const columns: ColumnDef<DimensionRow>[] = useMemo(
    () => [
      {
        header: () => "Name",
        accessorKey: "name",
      },
      {
        header: () => "Type",
        accessorKey: "type",
      },
      {
        header: () => "Value",
        accessorKey: "value",
      },
    ],
    []
  );

  const table = useReactTable<DimensionRow>({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <table css={tableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <th key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      {table.getCoreRowModel().rows.length ? (
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
  const documentText = event.documentText;
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
  } else if (documentText) {
    content = (
      <Accordion>
        <AccordionItem id="document" title="Document">
          <TextPre>{documentText}</TextPre>
        </AccordionItem>
      </Accordion>
    );
  } else if (promptAndResponse) {
    content = (
      <Accordion>
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
