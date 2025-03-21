import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
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
import { JSONText } from "@phoenix/components/code/JSONText";
import { PreformattedTextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import {
  SpanFeedback_annotations$data,
  SpanFeedback_annotations$key,
} from "./__generated__/SpanFeedback_annotations.graphql";
import { SpanAnnotationsEmpty } from "./SpanAnnotationsEmpty";

const columns: ColumnDef<
  SpanFeedback_annotations$data["spanAnnotations"][number]
>[] = [
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
  {
    header: "metadata",
    accessorKey: "metadata",
    minSize: 100,
    cell: ({ row }) => {
      const metadata = row.original.metadata;
      return metadata ? (
        <JSONText json={metadata} collapseSingleKey={false} />
      ) : (
        "--"
      );
    },
  },
];

function SpanAnnotationsTable({
  annotations,
}: {
  annotations: SpanFeedback_annotations$data["spanAnnotations"];
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

export function SpanFeedback({ span }: { span: SpanFeedback_annotations$key }) {
  const data = useFragment(
    graphql`
      fragment SpanFeedback_annotations on Span {
        spanAnnotations {
          id
          name
          label
          score
          explanation
          metadata
          annotatorKind
        }
      }
    `,
    span
  );

  const humanAnnotations = useMemo(() => {
    return data.spanAnnotations.filter(
      (annotation) => annotation.annotatorKind === "HUMAN"
    );
  }, [data.spanAnnotations]);
  const llmAnnotations = useMemo(() => {
    return data.spanAnnotations.filter(
      (annotation) => annotation.annotatorKind === "LLM"
    );
  }, [data.spanAnnotations]);
  const hasAnnotations = data.spanAnnotations.length > 0;
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
