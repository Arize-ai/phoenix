import { useCallback, useMemo, useRef, useState } from "react";
import { graphql, useMutation, usePaginationFragment } from "react-relay";
import { useLoaderData, useNavigate, useParams } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Button, Token } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { jobsLoaderQuery$data } from "./__generated__/jobsLoaderQuery.graphql";
import { JobsPage_jobs$key } from "./__generated__/JobsPage_jobs.graphql";
import { JobsPageResumeMutation } from "./__generated__/JobsPageResumeMutation.graphql";
import { JobsPageStopMutation } from "./__generated__/JobsPageStopMutation.graphql";

const PAGE_SIZE = 50;

const JobsPageFragment = graphql`
  fragment JobsPage_jobs on Dataset
  @refetchable(queryName: "JobsPageJobsQuery")
  @argumentDefinitions(
    after: { type: "String", defaultValue: null }
    first: { type: "Int", defaultValue: 50 }
  ) {
    experimentJobs(first: $first, after: $after)
      @connection(key: "JobsPage_experimentJobs") {
      edges {
        node {
          id
          isActive
          createdAt
          lastError
          experiment {
            id
            name
          }
        }
      }
    }
  }
`;

const StopExperimentMutation = graphql`
  mutation JobsPageStopMutation($experimentId: ID!) {
    stopExperiment(experimentId: $experimentId) {
      job {
        id
        isActive
      }
    }
  }
`;

const ResumeExperimentMutation = graphql`
  mutation JobsPageResumeMutation($experimentId: ID!) {
    resumeExperiment(experimentId: $experimentId) {
      job {
        id
        isActive
      }
    }
  }
`;

type JobNode = {
  id: string;
  isActive: boolean;
  createdAt: string;
  lastError: string | null;
  experiment: {
    id: string;
    name: string | null;
  };
};

export function JobsPage() {
  "use no memo";
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const navigate = useNavigate();
  const loaderData = useLoaderData<jobsLoaderQuery$data>();
  invariant(loaderData, "loaderData is required");

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment(
      JobsPageFragment,
      loaderData.dataset as JobsPage_jobs$key
    );

  const [stopExperiment] = useMutation<JobsPageStopMutation>(
    StopExperimentMutation
  );
  const [resumeExperiment] = useMutation<JobsPageResumeMutation>(
    ResumeExperimentMutation
  );

  // Cooldown state: tracks which experiments are disabled (in-flight or cooling down)
  const [disabledExperiments, setDisabledExperiments] = useState<Set<string>>(
    new Set()
  );
  const COOLDOWN_MS = 5000; // 5 seconds, matches backend

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const tableData = useMemo<JobNode[]>(
    () =>
      data.experimentJobs.edges.map(
        (edge: { node: JobNode }) => edge.node as JobNode
      ),
    [data]
  );

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  const handleStop = useCallback(
    (experimentId: string) => {
      // Disable immediately
      setDisabledExperiments((prev) => new Set(prev).add(experimentId));

      stopExperiment({
        variables: { experimentId },
        onCompleted: () => {
          refetch({}, { fetchPolicy: "network-only" });
          // Keep disabled for cooldown period
          setTimeout(() => {
            setDisabledExperiments((prev) => {
              const next = new Set(prev);
              next.delete(experimentId);
              return next;
            });
          }, COOLDOWN_MS);
        },
        onError: () => {
          // Re-enable immediately on error
          setDisabledExperiments((prev) => {
            const next = new Set(prev);
            next.delete(experimentId);
            return next;
          });
        },
      });
    },
    [stopExperiment, refetch]
  );

  const handleResume = useCallback(
    (experimentId: string) => {
      // Disable immediately
      setDisabledExperiments((prev) => new Set(prev).add(experimentId));

      resumeExperiment({
        variables: { experimentId },
        onCompleted: () => {
          refetch({}, { fetchPolicy: "network-only" });
          // Keep disabled for cooldown period
          setTimeout(() => {
            setDisabledExperiments((prev) => {
              const next = new Set(prev);
              next.delete(experimentId);
              return next;
            });
          }, COOLDOWN_MS);
        },
        onError: () => {
          // Re-enable immediately on error
          setDisabledExperiments((prev) => {
            const next = new Set(prev);
            next.delete(experimentId);
            return next;
          });
        },
      });
    },
    [resumeExperiment, refetch]
  );

  const handleExperimentClick = useCallback(
    (experimentId: string) => {
      navigate(`/datasets/${datasetId}/compare?experimentId=${experimentId}`);
    },
    [navigate, datasetId]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: [
      {
        header: "experiment",
        accessorKey: "experiment",
        cell: ({ row }) => {
          const job = row.original as JobNode;
          return (
            <button
              onClick={() => handleExperimentClick(job.experiment.id)}
              css={css`
                all: unset;
                cursor: pointer;
                color: var(--ac-global-color-blue-600);
                &:hover {
                  text-decoration: underline;
                }
              `}
            >
              {job.experiment.name}
            </button>
          );
        },
      },
      {
        header: "status",
        accessorKey: "isActive",
        cell: ({ row }) => {
          const job = row.original as JobNode;
          const isActive = job.isActive;
          return (
            <Token
              color={
                isActive
                  ? "var(--ac-global-color-green-600)"
                  : "var(--ac-global-color-grey-400)"
              }
            >
              {isActive ? "Active" : "Inactive"}
            </Token>
          );
        },
      },
      {
        header: "created",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "last error",
        accessorKey: "lastError",
        cell: TextCell,
      },
      {
        header: "actions",
        accessorKey: "id",
        cell: ({ row }) => {
          const job = row.original as JobNode;
          const isActive = job.isActive;
          const isDisabled = disabledExperiments.has(job.experiment.id);
          return (
            <Button
              size="S"
              isDisabled={isDisabled}
              onPress={() => {
                if (isActive) {
                  handleStop(job.experiment.id);
                } else {
                  handleResume(job.experiment.id);
                }
              }}
            >
              {isDisabled ? "..." : isActive ? "Stop" : "Resume"}
            </Button>
          );
        },
      },
    ],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      ref={tableContainerRef}
    >
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
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
            {rows.map((row) => {
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
        )}
      </table>
    </div>
  );
}
