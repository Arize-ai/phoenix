import { PropsWithChildren, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Counter,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Token,
  View,
} from "@phoenix/components";
import { Empty } from "@phoenix/components/Empty";
import { tableCSS } from "@phoenix/components/table/styles";
import { numberFormatter } from "@phoenix/utils/numberFormatUtils";
import { isAudioUrl, isVideoUrl } from "@phoenix/utils/urlUtils";

import { ModelEvent, RetrievalDocument } from "./types";

const detailsListCSS = css`
  margin: var(--ac-global-dimension-static-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-static-size-100);
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
        css={css`
          padding: var(--ac-global-dimension-static-size-200);
          color: var(--ac-global-text-color-900);
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
      <DisclosureGroup
        defaultExpandedKeys={[
          "prediction",
          "document",
          "dimensions",
          "retrievals",
        ]}
      >
        {isPredictionRecord ? (
          <Disclosure id="prediction">
            <DisclosureTrigger>Prediction Details</DisclosureTrigger>
            <DisclosurePanel>
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
            </DisclosurePanel>
          </Disclosure>
        ) : (
          <Disclosure id="document">
            <DisclosureTrigger>Document Details</DisclosureTrigger>
            <DisclosurePanel>
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
            </DisclosurePanel>
          </Disclosure>
        )}
        <Disclosure id="dimensions">
          <DisclosureTrigger>Dimensions</DisclosureTrigger>
          <DisclosurePanel>
            <EmbeddingDimensionsTable dimensions={event.dimensions} />
          </DisclosurePanel>
        </Disclosure>
        {hasRetrievals && (
          <Disclosure id="retrievals">
            <DisclosureTrigger>
              Retrieved Documents
              <Counter>{event.retrievedDocuments.length}</Counter>
            </DisclosureTrigger>
            <DisclosurePanel>
              <ul
                css={css`
                  padding: var(--ac-global-dimension-static-size-100);
                  li + li {
                    margin-top: var(--ac-global-dimension-static-size-100);
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
            </DisclosurePanel>
          </Disclosure>
        )}
      </DisclosureGroup>
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
              <Token color="var(--ac-global-color-blue-1000)">
                {`relevance ${numberFormatter(document.relevance)}`}
              </Token>
            )}
          </Flex>
        </View>
        <pre
          css={css`
            padding: var(--ac-global-dimension-static-size-200);
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

function DataURLPreview({ dataUrl }: { dataUrl: string }) {
  const isVideo = isVideoUrl(dataUrl);
  const isAudio = isAudioUrl(dataUrl);

  if (isVideo) {
    return (
      <video
        src={dataUrl}
        controls
        css={css`
          width: 100%;
          height: 500px;
          background-color: black;
        `}
      />
    );
  }
  if (isAudio) {
    return <audio src={dataUrl} controls autoPlay />;
  }
  return (
    <img
      src={dataUrl}
      alt="event image"
      width="100%"
      height="200px"
      css={css`
        object-fit: contain;
        background-color: black;
      `}
    />
  );
}
/**
 * Renders a top-level preview of the event
 */
function EventPreview({ event }: { event: ModelEvent }) {
  const dataUrl = event.linkToData || undefined;
  const rawData = event.rawData;
  const promptAndResponse: PromptResponse | null =
    event.prompt || event.response
      ? { prompt: event.prompt, response: event.response }
      : null;
  const documentText = event.documentText;
  let content = null;
  if (dataUrl) {
    content = (
      <Flex direction="column">
        <DataURLPreview dataUrl={dataUrl} />
        {rawData && (
          <Disclosure id="raw">
            <DisclosureTrigger>Raw Data</DisclosureTrigger>
            <DisclosurePanel>
              <TextPre>{rawData}</TextPre>
            </DisclosurePanel>
          </Disclosure>
        )}
      </Flex>
    );
  } else if (documentText) {
    content = (
      <Disclosure id="document">
        <DisclosureTrigger>Document</DisclosureTrigger>
        <DisclosurePanel>
          <TextPre>{documentText}</TextPre>
        </DisclosurePanel>
      </Disclosure>
    );
  } else if (promptAndResponse) {
    content = (
      <DisclosureGroup defaultExpandedKeys={["prompt", "response"]}>
        <Disclosure id="prompt">
          <DisclosureTrigger>Prompt</DisclosureTrigger>
          <DisclosurePanel>
            <TextPre>{promptAndResponse.prompt}</TextPre>
          </DisclosurePanel>
        </Disclosure>
        <Disclosure id="response">
          <DisclosureTrigger>Response</DisclosureTrigger>
          <DisclosurePanel>
            <TextPre>{promptAndResponse.response}</TextPre>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
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
          css={css`
            text-align: center;
            padding: var(--ac-global-dimension-size-300)
              var(--ac-global-dimension-size-300) !important;
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
