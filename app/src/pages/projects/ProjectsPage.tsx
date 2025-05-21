import {
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
} from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  OnChangeFn,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistance } from "date-fns";
import { Subscription } from "relay-runtime";
import { css } from "@emotion/react";

import { useNotification } from "@arizeai/components";

import {
  Flex,
  FlexProps,
  Heading,
  Icon,
  Icons,
  Link,
  Loading,
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useTimeRange,
} from "@phoenix/components/datetime";
import { LoadMoreButton } from "@phoenix/components/LoadMoreButton";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { usePreferencesContext } from "@phoenix/contexts";
import {
  ProjectsPageProjectMetricsQuery,
  ProjectsPageProjectMetricsQuery$data,
} from "@phoenix/pages/projects/__generated__/ProjectsPageProjectMetricsQuery.graphql";
import { ProjectViewModeToggle } from "@phoenix/pages/projects/ProjectViewModeToggle";
import { ProjectSortOrder } from "@phoenix/store/preferencesStore";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ProjectsPageProjectsFragment$data,
  ProjectsPageProjectsFragment$key,
} from "./__generated__/ProjectsPageProjectsFragment.graphql";
import {
  ProjectSort,
  ProjectsPageProjectsQuery,
} from "./__generated__/ProjectsPageProjectsQuery.graphql";
import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectActionMenu } from "./ProjectActionMenu";
import { ProjectsSearch } from "./ProjectsSearch";

const PAGE_SIZE = 10;

const useProjectSortQueryParams = () => {
  const { projectSortOrder } = usePreferencesContext((state) => ({
    projectViewMode: state.projectViewMode,
    projectSortOrder: state.projectSortOrder,
  }));
  const params = useMemo(() => {
    return {
      sort: {
        col: projectSortOrder.column,
        dir: projectSortOrder.direction,
      },
    };
  }, [projectSortOrder]);
  return params;
};

export function ProjectsPage() {
  const { timeRange } = useTimeRange();
  const _queryParams = useProjectSortQueryParams();
  // we only want to trigger the initial query when the component mounts
  // so we want to cache the initial state of the query params
  // this prevents full page reloads when the sort order changes
  const [queryParams] = useState(() => _queryParams);
  const data = useLazyLoadQuery<ProjectsPageQuery>(
    graphql`
      query ProjectsPageQuery(
        $first: Int
        $sort: ProjectSort
        $filter: ProjectFilter
      ) {
        ...ProjectsPageProjectsFragment
          @arguments(first: $first, sort: $sort, filter: $filter)
      }
    `,
    {
      first: PAGE_SIZE,
      ...queryParams,
    }
  );

  return (
    <Suspense fallback={<Loading />}>
      <ProjectsPageContent timeRange={timeRange} query={data} />
    </Suspense>
  );
}

export function ProjectsPageContent({
  timeRange,
  query,
}: {
  timeRange: OpenTimeRange;
  query: ProjectsPageProjectsFragment$key;
}) {
  const { projectViewMode } = usePreferencesContext((state) => ({
    projectViewMode: state.projectViewMode,
  }));
  const sortQueryParams = useProjectSortQueryParams();
  const [filter, setFilter] = useState<string>("");
  const [notify, holder] = useNotification();
  // Convert the time range to a variable that can be used in the query
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    };
  }, [timeRange]);

  const {
    data: projectsData,
    loadNext,
    hasNext,
    isLoadingNext,
    refetch: _refetch,
  } = usePaginationFragment<
    ProjectsPageProjectsQuery,
    ProjectsPageProjectsFragment$key
  >(
    graphql`
      fragment ProjectsPageProjectsFragment on Query
      @refetchable(queryName: "ProjectsPageProjectsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
        sort: { type: "ProjectSort", defaultValue: null }
        filter: { type: "ProjectFilter", defaultValue: null }
      ) {
        projects(first: $first, after: $after, sort: $sort, filter: $filter)
          @connection(key: "ProjectsPage_projects") {
          edges {
            project: node {
              id
              name
              gradientStartColor
              gradientEndColor
              endTime
              startTime
            }
          }
        }
      }
    `,
    query
  );

  const queryArgs = useMemo(
    () => ({
      ...sortQueryParams,
      filter: { value: filter, col: "name" as const },
    }),
    [sortQueryParams, filter]
  );

  const refetch = useCallback(
    ({
      vars,
      onComplete,
    }: {
      vars?: Partial<Parameters<typeof _refetch>[0]>;
      onComplete?: () => void;
    }) => {
      startTransition(() => {
        _refetch(
          {
            ...queryArgs,
            ...vars,
          },
          {
            fetchPolicy: "store-and-network",
            onComplete: () => {
              onComplete?.();
            },
          }
        );
      });
    },
    [_refetch, queryArgs]
  );

  const projects = projectsData?.projects.edges.map((p) => p.project);

  const projectsContainerRef = useRef<HTMLDivElement>(null);
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the scrollable container, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: queryArgs });
        }
      }
    },
    [hasNext, isLoadingNext, loadNext, queryArgs]
  );

  const onSort = useCallback(
    (sort: ProjectSort) => {
      refetch({
        vars: {
          sort,
        },
      });
    },
    [refetch]
  );

  const onDelete = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({
          onComplete: () => {
            notify({
              variant: "success",
              title: "Project Deleted",
              message: `Project ${projectName} has been deleted.`,
            });
          },
        });
      });
    },
    [notify, refetch]
  );

  const onClear = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({
          onComplete: () => {
            notify({
              variant: "success",
              title: "Project Cleared",
              message: `Project ${projectName} has been cleared of traces.`,
            });
          },
        });
      });
    },
    [notify, refetch]
  );

  const onRemove = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({
          onComplete: () => {
            notify({
              variant: "success",
              title: "Project Data Removed",
              message: `Old data from project ${projectName} have been removed.`,
            });
          },
        });
      });
    },
    [notify, refetch]
  );

  const loadNextWithArgs = useCallback(() => {
    loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: queryArgs });
  }, [loadNext, queryArgs]);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        overflow: auto;
      `}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      ref={projectsContainerRef}
    >
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        width="100%"
        borderBottomColor="grey-200"
        borderBottomWidth="thin"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <ProjectsSearch
            onChange={(newSearch) => {
              setFilter(newSearch);
              refetch({
                vars: {
                  filter: { value: newSearch, col: "name" },
                },
              });
            }}
          />
          <Flex
            direction="row"
            justifyContent="end"
            alignItems="center"
            gap="size-100"
            css={css`
              button {
                text-wrap: nowrap;
              }
            `}
          >
            <ProjectViewModeToggle />
            <ConnectedLastNTimeRangePicker />
            <NewProjectButton variant="primary" />
          </Flex>
        </Flex>
      </View>
      {projectViewMode === "grid" ? (
        <div
          css={css`
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
          `}
        >
          <ProjectsGrid
            projects={projects}
            onDelete={onDelete}
            onClear={onClear}
            onRemove={onRemove}
            timeRangeVariable={timeRangeVariable}
            hasNext={hasNext}
            loadNext={loadNextWithArgs}
            isLoadingNext={isLoadingNext}
            onSort={onSort}
          />
        </div>
      ) : (
        <div
          css={css`
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
          `}
        >
          <ProjectsTable
            projects={projects}
            onDelete={onDelete}
            onClear={onClear}
            onRemove={onRemove}
            timeRangeVariable={timeRangeVariable}
            hasNext={hasNext}
            loadNext={loadNextWithArgs}
            isLoadingNext={isLoadingNext}
            onSort={onSort}
          />
        </div>
      )}
      {holder}
    </div>
  );
}

type ProjectViewComponentProps = {
  projects: ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"][];
  onDelete: (projectName: string) => void;
  onClear: (projectName: string) => void;
  onRemove: (projectName: string) => void;
  timeRangeVariable: {
    start: string | undefined;
    end: string | undefined;
  };
  hasNext: boolean;
  loadNext: () => void;
  isLoadingNext: boolean;
  onSort: (sort: ProjectSort) => void;
};

function ProjectsGrid({
  projects,
  onDelete,
  onClear,
  onRemove,
  timeRangeVariable,
  hasNext,
  loadNext,
  isLoadingNext,
}: ProjectViewComponentProps) {
  return (
    <View padding="size-200" width="100%">
      <ul
        css={css`
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(var(--ac-global-dimension-size-3600), 1fr)
          );
          gap: var(--ac-global-dimension-size-200);
        `}
      >
        {projects?.map((project) => (
          <li
            key={project.id}
            css={css`
              display: flex;
              flex-direction: column;
              height: 100%;
              & > div {
                height: 100%;
              }
            `}
          >
            <Link
              title={project.name}
              to={`/projects/${project.id}`}
              css={css`
                text-decoration: none;
                display: flex;
                flex-direction: column;
                height: 100%;
              `}
            >
              <ProjectItem
                project={project}
                timeRange={timeRangeVariable}
                onProjectDelete={() => onDelete(project.name)}
                onProjectClear={() => onClear(project.name)}
                onProjectRemoveData={() => onRemove(project.name)}
              />
            </Link>
          </li>
        ))}
      </ul>
      {hasNext && (
        <Flex
          width="100%"
          justifyContent="center"
          alignItems="center"
          marginTop="size-200"
        >
          <LoadMoreButton onLoadMore={loadNext} isLoadingNext={isLoadingNext} />
        </Flex>
      )}
    </View>
  );
}

function ProjectIcon({
  gradientStartColor,
  gradientEndColor,
}: {
  gradientStartColor: string;
  gradientEndColor: string;
}) {
  return (
    <div
      css={css`
        border-radius: 50%;
        width: 32px;
        height: 32px;
        background: linear-gradient(
          136.27deg,
          ${gradientStartColor} 14.03%,
          ${gradientEndColor} 84.38%
        );
        flex-shrink: 0;
      `}
    />
  );
}
type ProjectItemProps = {
  project: ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"];
  onProjectDelete: () => void;
  onProjectClear: () => void;
  onProjectRemoveData: () => void;
  timeRange: {
    start: string | undefined;
    end: string | undefined;
  };
};

function ProjectItem({
  project,
  onProjectDelete,
  onProjectClear,
  onProjectRemoveData,
  timeRange,
}: ProjectItemProps) {
  const { gradientStartColor, gradientEndColor, endTime } = project;
  const lastUpdatedText = useMemo(() => {
    if (endTime) {
      return `Last updated  ${formatDistance(new Date(endTime), new Date(), { addSuffix: true })}`;
    }
    return "No traces uploaded yet.";
  }, [endTime]);
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-size-200);
        border: 1px solid var(--ac-global-color-grey-400);
        background-color: var(--ac-global-color-grey-100);
        box-shadow:
          0 0 1px 0px var(--ac-global-color-grey-400) inset,
          0 0 1px 0px var(--ac-global-color-grey-400);
        border-radius: var(--ac-global-rounding-medium);
        transition: border-color 0.2s;
        &:hover {
          border-color: var(--ac-global-color-primary);
        }
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--ac-global-dimension-size-200);
        height: 100%;
      `}
    >
      <Flex direction="row" justifyContent="space-between" alignItems="start">
        <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
          <ProjectIcon
            gradientStartColor={gradientStartColor}
            gradientEndColor={gradientEndColor}
          />
          <Flex direction="column" minWidth={0}>
            <Heading
              level={2}
              css={css`
                overflow: hidden;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 1;
                overflow: hidden;
              `}
            >
              {project.name}
            </Heading>
            <Text color="text-700" size="XS" fontStyle="italic">
              {lastUpdatedText}
            </Text>
          </Flex>
        </Flex>
        <ProjectActionMenu
          projectId={project.id}
          projectName={project.name}
          onProjectDelete={onProjectDelete}
          onProjectClear={onProjectClear}
          onProjectRemoveData={onProjectRemoveData}
        />
      </Flex>
      <ProjectMetrics projectId={project.id} timeRange={timeRange} />
    </div>
  );
}

const PROJECT_METRICS_QUERY = graphql`
  query ProjectsPageProjectMetricsQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ... on Project {
        traceCount(timeRange: $timeRange)
        latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)
        tokenCountTotal(timeRange: $timeRange)
      }
    }
  }
`;

function ProjectMetricsLoadingSkeleton() {
  return (
    <Flex direction="row" justifyContent="space-between" minHeight="size-600">
      <Flex direction="column" flex="none" gap="size-100">
        <Text elementType="h3" size="S" color="text-700">
          Total Traces
        </Text>
        <Skeleton width={60} height={20} animation="wave" />
      </Flex>
      <Flex direction="column" flex="none" gap="size-100">
        <Text elementType="h3" size="S" color="text-700">
          Total Tokens
        </Text>
        <Skeleton width={60} height={20} animation="wave" />
      </Flex>
      <Flex direction="column" flex="none" gap="size-100">
        <Text elementType="h3" size="S" color="text-700">
          Latency P50
        </Text>
        <Skeleton width={60} height={20} animation="wave" />
      </Flex>
    </Flex>
  );
}

const ProjectMetrics = memo(function ProjectMetrics({
  projectId,
  timeRange,
  flexProps,
}: {
  projectId: string;
  timeRange: {
    start: string | undefined;
    end: string | undefined;
  };
  flexProps?: Partial<FlexProps>;
}) {
  const environment = useRelayEnvironment();
  // ref to the current running "subscription", a.k.a. the current running query request
  const subscriptionRef = useRef<Subscription | null>(null);
  // state to hold the result of the project metrics query
  const [projectMetrics, setProjectMetrics] =
    useState<ProjectsPageProjectMetricsQuery$data | null>(null);
  /**
   * fetchProject is a function that fetches the project metrics for the given project id and time range
   * it clears the current project metrics and then fetches the new project metrics
   * it returns a "subscription" object that can be used to unsubscribe from the query
   * It is NOT websockets, polling, or streaming, it is a normal fetch wrapped in a relay subscription provided by the relay environment
   * this works because the relay environment is configured to abort the underlying fetch if the subscription is unsubscribed from
   */
  const fetchProject = useCallback(() => {
    setProjectMetrics(null);
    const observable = fetchQuery<ProjectsPageProjectMetricsQuery>(
      environment,
      PROJECT_METRICS_QUERY,
      { id: projectId, timeRange }
    );
    const subscription = observable.subscribe({
      next: (data) => {
        setProjectMetrics(data);
      },
      error: () => {
        setProjectMetrics(null);
      },
    });
    return subscription;
  }, [projectId, timeRange, environment]);
  // when the component mounts, or the time range changes, we fetch the project metrics
  useEffect(() => {
    subscriptionRef.current = fetchProject();
    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [fetchProject]);
  // if the project metrics are not loaded yet, we show a loading indicator
  if (projectMetrics == null) {
    return <ProjectMetricsLoadingSkeleton />;
  }
  // if the project metrics are loaded, we show the project metrics
  return <ProjectMetricsRow project={projectMetrics} flexProps={flexProps} />;
});

function ProjectMetricsRow({
  project,
  flexProps,
}: {
  project: ProjectsPageProjectMetricsQuery$data;
  flexProps?: Partial<FlexProps>;
}) {
  const {
    project: { traceCount, tokenCountTotal, latencyMsP50 },
  } = project;
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      minHeight="size-600"
      {...flexProps}
    >
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Total Traces
        </Text>
        <Text size="L">{intFormatter(traceCount)}</Text>
      </Flex>
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Total Tokens
        </Text>
        <Text size="L">{intFormatter(tokenCountTotal)}</Text>
      </Flex>
      <Flex direction="column" flex="none">
        <Text elementType="h3" size="S" color="text-700">
          Latency P50
        </Text>
        {latencyMsP50 != null ? (
          <LatencyText latencyMs={latencyMsP50} size="L" />
        ) : (
          <Text size="L">--</Text>
        )}
      </Flex>
    </Flex>
  );
}

const SORT_COLUMNS = ["name", "endTime"] satisfies ProjectSortOrder["column"][];

function ProjectsTable({
  projects,
  onDelete,
  onClear,
  onRemove,
  timeRangeVariable,
  hasNext,
  loadNext,
  isLoadingNext,
  onSort,
}: ProjectViewComponentProps) {
  const navigate = useNavigate();
  const columns: ColumnDef<
    ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"]
  >[] = useMemo(
    () =>
      [
        {
          header: "name",
          accessorKey: "name",
          maxSize: 135,
          cell: ({ row }) => {
            return (
              <Flex direction="row" gap="size-200" alignItems="center">
                <ProjectIcon
                  gradientStartColor={row.original.gradientStartColor}
                  gradientEndColor={row.original.gradientEndColor}
                />
                <Link to={`/projects/${row.original.id}`}>
                  <Truncate maxWidth="300px">{row.original.name}</Truncate>
                </Link>
              </Flex>
            );
          },
        },
        {
          header: "last updated at",
          accessorKey: "endTime",
          maxSize: 30,
          cell: TimestampCell,
        },
        {
          header: "metrics",
          id: "metrics",
          enableSorting: false,
          cell: ({ row }) => {
            return (
              <div
                css={css`
                  max-width: 100%;
                `}
              >
                <ProjectMetrics
                  flexProps={{
                    justifyContent: "start",
                    gap: "size-800",
                    wrap: "wrap",
                    rowGap: "size-100",
                  }}
                  projectId={row.original.id}
                  timeRange={timeRangeVariable}
                />
              </div>
            );
          },
        },
        {
          header: "",
          id: "actions",
          enableSorting: false,
          size: 10,
          maxSize: 10,
          minSize: 10,
          cell: ({ row }) => {
            return (
              <ProjectActionMenu
                variant="default"
                projectId={row.original.id}
                projectName={row.original.name}
                onProjectClear={() => onClear(row.original.name)}
                onProjectRemoveData={() => onRemove(row.original.name)}
                onProjectDelete={() => onDelete(row.original.name)}
              />
            );
          },
        },
      ] satisfies ColumnDef<
        ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"]
      >[],
    [timeRangeVariable, onClear, onDelete, onRemove]
  );
  const sortQueryParams = useProjectSortQueryParams();
  const { setProjectSortOrder } = usePreferencesContext((state) => ({
    setProjectSortOrder: state.setProjectSortOrder,
  }));
  const sortingRowModel = useMemo(() => {
    return [
      {
        id: sortQueryParams.sort.col,
        desc: sortQueryParams.sort.dir === "desc",
      },
    ] satisfies SortingState;
  }, [sortQueryParams.sort.col, sortQueryParams.sort.dir]);
  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      if (typeof updater === "function") {
        const sorting = updater(sortingRowModel);
        const [first] = sorting;
        if (first == null) {
          return;
        }
        const column = first.id as (typeof SORT_COLUMNS)[number];
        if (!SORT_COLUMNS.includes(column)) {
          return;
        }
        onSort({
          col: column,
          dir: first.desc ? "desc" : "asc",
        });
        setProjectSortOrder({
          column,
          direction: first.desc ? "desc" : "asc",
        });
      }
    },
    [setProjectSortOrder, sortingRowModel, onSort]
  );
  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      sorting: sortingRowModel,
    },
    enableSortingRemoval: false,
    onSortingChange,
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <View flex="none" height="100%" width="100%">
      <div
        css={css`
          flex: 1 1 auto;
          height: 100%;
          width: 100%;
        `}
      >
        <table css={tableCSS} data-testid="projects-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    colSpan={header.colSpan}
                    key={header.id}
                    style={{
                      width: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? "cursor-pointer"
                            : "",
                          onClick: header.column.getToggleSortingHandler(),
                          style: {
                            left: header.getStart(),
                            width: header.getSize(),
                            textWrap: "nowrap",
                          },
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() ? (
                          <Icon
                            className="sort-icon"
                            svg={
                              header.column.getIsSorted() === "asc" ? (
                                <Icons.ArrowUpFilled />
                              ) : (
                                <Icons.ArrowDownFilled />
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
          {isEmpty ? (
            <TableEmpty />
          ) : (
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    navigate(`/projects/${row.original.id}`);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {hasNext ? (
          <View paddingY="size-200">
            <Flex
              direction="row"
              justifyContent="center"
              alignItems="center"
              width="100%"
            >
              <LoadMoreButton
                onLoadMore={loadNext}
                isLoadingNext={isLoadingNext}
              />
            </Flex>
          </View>
        ) : null}
      </div>
    </View>
  );
}
