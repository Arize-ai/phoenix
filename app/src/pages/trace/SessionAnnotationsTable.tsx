import { css } from "@emotion/react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import { Alert, Flex, Icon, Icons, Truncate } from "@phoenix/components";
import { JSONText } from "@phoenix/components/code/JSONText";
import { PreformattedTextCell } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { SessionAnnotationDeleteButton } from "@phoenix/components/trace/SessionAnnotationDeleteButton";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useNotifySuccess } from "@phoenix/contexts";

import type {
  SessionAnnotationsTable_annotations$data,
  SessionAnnotationsTable_annotations$key,
} from "./__generated__/SessionAnnotationsTable_annotations.graphql";
import type { SessionAnnotationsTableQuery } from "./__generated__/SessionAnnotationsTableQuery.graphql";
import { AnnotationsEmpty } from "./AnnotationsEmpty";

type SessionAnnotation =
  SessionAnnotationsTable_annotations$data["sessionAnnotations"][number];

const tableWrapCSS = css`
  flex: 1 1 auto;
  overflow: auto;
`;

function AnnotationsTable({
  annotations,
  sessionNodeId,
}: {
  annotations: readonly SessionAnnotation[];
  sessionNodeId: string;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<SessionAnnotation>[]>(
    () => [
      {
        header: "name",
        accessorKey: "name",
        size: 100,
      },
      {
        header: "annotator kind",
        accessorKey: "annotatorKind",
        size: 100,
        cell: ({ row }) => (
          <AnnotatorKindToken kind={row.original.annotatorKind} />
        ),
      },
      {
        header: "user",
        accessorKey: "user",
        size: 100,
        cell: ({ row }) => {
          const user = row.original.user;
          const userName = user?.username || "system";
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <UserPicture
                name={userName}
                profilePictureUrl={user?.profilePictureUrl || null}
                size={18}
              />
              <span>{userName}</span>
            </Flex>
          );
        },
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
        header: "source",
        accessorKey: "source",
        size: 100,
      },
      {
        header: "identifier",
        accessorKey: "identifier",
        size: 100,
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
      {
        header: "created at",
        accessorKey: "createdAt",
        size: 100,
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorKey: "updatedAt",
        size: 100,
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "actions",
        size: 50,
        enableSorting: false,
        cell: ({ row }) => (
          <SessionAnnotationDeleteButton
            annotationId={row.original.id}
            sessionNodeId={sessionNodeId}
            annotationName={row.original.name}
            onDeleteSuccess={notifySuccess}
            onDeleteError={(error) => {
              setError(error.message);
            }}
          />
        ),
      },
    ],
    [sessionNodeId, notifySuccess]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const data = useMemo(() => [...annotations], [annotations]);
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      columnPinning: {
        right: ["actions"],
      },
    },
  });
  const rows = table.getRowModel().rows;

  return (
    <div css={tableWrapCSS}>
      {error && <Alert variant="danger">{error}</Alert>}
      <table css={tableCSS} data-testid="session-annotations-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  colSpan={header.colSpan}
                  key={header.id}
                  style={getCommonPinningStyles(header.column)}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      className={header.column.getCanSort() ? "sort" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Truncate maxWidth="100%">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </Truncate>
                      {header.column.getIsSorted() ? (
                        <Icon
                          className="sort-icon"
                          svg={
                            header.column.getIsSorted() === "asc" ? (
                              <Icons.CaretUpFilled />
                            ) : (
                              <Icons.CaretDownFilled />
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
        {rows.length === 0 ? (
          <TableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={getCommonPinningStyles(cell.column)}>
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
}

/**
 * The annotations view of a session. Fetches and displays every annotation
 * attached to the session. Mounted only when the annotations tab is selected.
 */
export function SessionAnnotationsTable({ sessionId }: { sessionId: string }) {
  "use no memo";
  const queryData = useLazyLoadQuery<SessionAnnotationsTableQuery>(
    graphql`
      query SessionAnnotationsTableQuery($id: ID!) {
        session: node(id: $id) {
          ...SessionAnnotationsTable_annotations
        }
      }
    `,
    { id: sessionId },
    { fetchPolicy: "store-and-network" }
  );

  const data = useFragment<SessionAnnotationsTable_annotations$key>(
    graphql`
      fragment SessionAnnotationsTable_annotations on ProjectSession {
        id
        sessionAnnotations {
          id
          name
          label
          score
          explanation
          metadata
          annotatorKind
          identifier
          source
          createdAt
          updatedAt
          user {
            id
            username
            profilePictureUrl
          }
        }
      }
    `,
    queryData.session
  );

  if (data == null) {
    throw new Error("Session not found");
  }

  const annotations = data.sessionAnnotations;

  if (annotations.length === 0) {
    return <AnnotationsEmpty description="No annotations for this session" />;
  }
  return <AnnotationsTable annotations={annotations} sessionNodeId={data.id} />;
}
