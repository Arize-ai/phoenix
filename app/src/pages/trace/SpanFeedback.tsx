import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components";
import { PreformattedTextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import {
  SpanFeedbackQuery,
  SpanFeedbackQuery$data,
} from "./__generated__/SpanFeedbackQuery.graphql";
import { SpanAnnotationsEmpty } from "./SpanAnnotationsEmpty";

const columns = [
  {
    header: "name",
    accessorKey: "name",
    size: 100,
  },
  {
    header: "label",
    accessorKey: "label",
    size: 100,
  },
  {
    header: "score",
    accessorKey: "score",
    size: 100,
  },
  {
    header: "explanation",
    accessorKey: "explanation",
    cell: PreformattedTextCell,
    size: 400,
  },
];

function SpanAnnotationsTable({
  annotations,
}: {
  annotations: NonNullable<
    NonNullable<SpanFeedbackQuery$data["span"]>["spanAnnotations"]
  >;
}) {
  const tableData = useMemo(() => [...annotations], [annotations]);
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <table css={tableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th colSpan={header.colSpan} key={header.id}>
                {header.isPlaceholder ? null : (
                  <>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {isEmpty ? (
        <TableEmpty />
      ) : (
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
      )}
    </table>
  );
}

export function SpanFeedback({ spanId }: { spanId: string }) {
  const data = useLazyLoadQuery<SpanFeedbackQuery>(
    graphql`
      query SpanFeedbackQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            spanAnnotations {
              name
              label
              score
              explanation
              annotatorKind
            }
          }
        }
      }
    `,
    { spanId }
  );

  const annotations = useMemo(() => data?.span?.spanAnnotations || [], [data]);

  const humanAnnotations = useMemo(() => {
    return annotations.filter(
      (annotation) => annotation.annotatorKind === "HUMAN"
    );
  }, [annotations]);
  const llmAnnotations = useMemo(() => {
    return annotations.filter(
      (annotation) => annotation.annotatorKind === "LLM"
    );
  }, [annotations]);
  const hasAnnotations = annotations.length > 0;
  return hasAnnotations ? (
    <DisclosureGroup defaultExpandedKeys={["evaluations", "human"]}>
      <Disclosure id="evaluations">
        <DisclosureTrigger>Evaluations</DisclosureTrigger>
        <DisclosurePanel>
          <SpanAnnotationsTable annotations={llmAnnotations} />
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="human">
        <DisclosureTrigger>Human Annotations</DisclosureTrigger>
        <DisclosurePanel>
          <SpanAnnotationsTable annotations={humanAnnotations} />
        </DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  ) : (
    <SpanAnnotationsEmpty />
  );
}
