import React, {
  startTransition,
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
import { formatDistance } from "date-fns";
import { debounce } from "lodash";
import { Subscription } from "relay-runtime";
import { css } from "@emotion/react";

import { useNotification } from "@arizeai/components";

import {
  Flex,
  Heading,
  Input,
  Link,
  Skeleton,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useTimeRange,
} from "@phoenix/components/datetime";
import { LoadMoreButton } from "@phoenix/components/LoadMoreButton";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { usePreferencesContext } from "@phoenix/contexts";
import {
  ProjectsPageProjectMetricsQuery,
  ProjectsPageProjectMetricsQuery$data,
} from "@phoenix/pages/projects/__generated__/ProjectsPageProjectMetricsQuery.graphql";
import { ProjectSortMenu } from "@phoenix/pages/projects/ProjectSortMenu";
import { ProjectViewModeToggle } from "@phoenix/pages/projects/ProjectViewModeToggle";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ProjectsPageProjectsFragment$data,
  ProjectsPageProjectsFragment$key,
} from "./__generated__/ProjectsPageProjectsFragment.graphql";
import {
  ProjectFilter,
  ProjectsPageProjectsQuery,
} from "./__generated__/ProjectsPageProjectsQuery.graphql";
import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectActionMenu } from "./ProjectActionMenu";

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
    { first: PAGE_SIZE, ...queryParams }
  );

  return <ProjectsPageContent timeRange={timeRange} query={data} />;
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
  const [filter, setFilter] = useState<ProjectFilter | null>(null);
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
    refetch,
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
      filter,
    }),
    [sortQueryParams, filter]
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

  const onDelete = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch(queryArgs, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Deleted",
          message: `Project ${projectName} has been deleted.`,
        });
      });
    },
    [notify, refetch, queryArgs]
  );

  const onClear = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch(queryArgs, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Cleared",
          message: `Project ${projectName} has been cleared of traces.`,
        });
      });
    },
    [notify, refetch, queryArgs]
  );

  const onRemove = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch(queryArgs, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Data Removed",
          message: `Old data from project ${projectName} have been removed.`,
        });
      });
    },
    [notify, refetch, queryArgs]
  );

  const debouncedRefetch = useMemo(() => {
    return debounce(() => {
      refetch(queryArgs, { fetchPolicy: "store-and-network" });
    }, 1000);
  }, [refetch, queryArgs]);

  useEffect(() => {
    debouncedRefetch();
  }, [debouncedRefetch, queryArgs]);

  const loadNextWithArgs = useCallback(() => {
    loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: queryArgs });
  }, [loadNext, queryArgs]);

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow-y: auto;
        overflow-x: hidden;
        padding-bottom: var(--ac-global-dimension-size-750);
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
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <Flex direction="row" alignItems="center" gap="size-100" width="100%">
            <TextField
              size="S"
              css={css`
                flex-basis: 100%;
              `}
              aria-label="Filter projects by name"
              onChange={(value) => {
                if (value.length > 0) {
                  setFilter({ value, col: "name" });
                } else {
                  setFilter(null);
                }
              }}
            >
              <Input placeholder="Filter projects by name" />
            </TextField>
            <ProjectViewModeToggle />
          </Flex>
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
            <NewProjectButton />
            <ConnectedLastNTimeRangePicker />
          </Flex>
        </Flex>
      </View>
      <View padding="size-200" width="100%">
        {projectViewMode === "grid" ? (
          <Flex direction="column" gap="size-200">
            <Flex direction="row" justifyContent="end" alignItems="center">
              <ProjectSortMenu />
            </Flex>
            <Flex direction="column">
              <ProjectGrid
                projects={projects}
                onDelete={onDelete}
                onClear={onClear}
                onRemove={onRemove}
                timeRangeVariable={timeRangeVariable}
                hasNext={hasNext}
                loadNext={loadNextWithArgs}
                isLoadingNext={isLoadingNext}
              />
            </Flex>
          </Flex>
        ) : null}
      </View>
      {holder}
    </div>
  );
}

function ProjectGrid({
  projects,
  onDelete,
  onClear,
  onRemove,
  timeRangeVariable,
  hasNext,
  loadNext,
  isLoadingNext,
}: {
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
}) {
  return (
    <>
      <ul
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(312px, 1fr));
          gap: var(--ac-global-dimension-size-300);
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
    </>
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
        width: var(--ac-global-dimension-size-3600);
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
                -webkit-line-clamp: 2;
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
  query ProjectsPageProjectMetricsQuery(
    $id: GlobalID!
    $timeRange: TimeRange!
  ) {
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

function ProjectMetrics({
  projectId,
  timeRange,
}: {
  projectId: string;
  timeRange: {
    start: string | undefined;
    end: string | undefined;
  };
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
  return <ProjectMetricsRow project={projectMetrics} />;
}

function ProjectMetricsRow({
  project,
}: {
  project: ProjectsPageProjectMetricsQuery$data;
}) {
  const {
    project: { traceCount, tokenCountTotal, latencyMsP50 },
  } = project;
  return (
    <Flex direction="row" justifyContent="space-between" minHeight="size-600">
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
