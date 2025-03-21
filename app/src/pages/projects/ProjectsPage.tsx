import React, {
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
import { formatDistance } from "date-fns";
import { Subscription } from "relay-runtime";
import { css } from "@emotion/react";

import { useNotification } from "@arizeai/components";

import { Flex, Heading, Link, Loading, Text, View } from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useTimeRange,
} from "@phoenix/components/datetime";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import {
  ProjectsPageProjectMetricsQuery,
  ProjectsPageProjectMetricsQuery$data,
} from "@phoenix/pages/projects/__generated__/ProjectsPageProjectMetricsQuery.graphql";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ProjectsPageProjectsFragment$data,
  ProjectsPageProjectsFragment$key,
} from "./__generated__/ProjectsPageProjectsFragment.graphql";
import { ProjectsPageProjectsQuery } from "./__generated__/ProjectsPageProjectsQuery.graphql";
import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectActionMenu } from "./ProjectActionMenu";
import { ProjectsAutoRefreshToggle } from "./ProjectsAutoRefreshToggle";

// 3 minutes
// just in case the queries take longer than 1 minute to complete
const REFRESH_INTERVAL_MS = 60 * 3 * 1000;
const PAGE_SIZE = 50;

export function ProjectsPage() {
  const { timeRange } = useTimeRange();

  return (
    <Suspense fallback={<Loading />}>
      <ProjectsPageContent timeRange={timeRange} />
    </Suspense>
  );
}

export function ProjectsPageContent({
  timeRange,
}: {
  timeRange: OpenTimeRange;
}) {
  const autoRefreshEnabled = usePreferencesContext(
    (state) => state.projectsAutoRefreshEnabled
  );
  const [notify, holder] = useNotification();
  // Convert the time range to a variable that can be used in the query
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    };
  }, [timeRange]);

  const data = useLazyLoadQuery<ProjectsPageQuery>(
    graphql`
      query ProjectsPageQuery {
        ...ProjectsPageProjectsFragment
      }
    `,
    {}
  );
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
      ) {
        projects(first: $first, after: $after)
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
    data
  );
  const projects = projectsData.projects.edges.map((p) => p.project);

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
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  useInterval(
    () => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "store-and-network" });
      });
    },
    autoRefreshEnabled ? REFRESH_INTERVAL_MS : null
  );

  const onDelete = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Deleted",
          message: `Project ${projectName} has been deleted.`,
        });
      });
    },
    [notify, refetch]
  );

  const onClear = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Cleared",
          message: `Project ${projectName} has been cleared of traces.`,
        });
      });
    },
    [notify, refetch]
  );

  const onRemove = useCallback(
    (projectName: string) => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "store-and-network" });
        notify({
          variant: "success",
          title: "Project Data Removed",
          message: `Old data from project ${projectName} have been removed.`,
        });
      });
    },
    [notify, refetch]
  );

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
          justifyContent="end"
          alignItems="center"
          gap="size-100"
        >
          <ProjectsAutoRefreshToggle />
          <NewProjectButton />
          <ConnectedLastNTimeRangePicker />
        </Flex>
      </View>
      <View padding="size-200" width="100%">
        <ul
          css={css`
            display: flex;
            flex-direction: row;
            gap: var(--ac-global-dimension-size-200);
            flex-wrap: wrap;
          `}
        >
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${project.id}/spans`}
                css={css`
                  text-decoration: none;
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
      </View>
      {holder}
    </div>
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
                white-space: nowrap;
                text-overflow: ellipsis;
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
      <Suspense fallback={<Loading />}>
        <ProjectMetrics projectId={project.id} timeRange={timeRange} />
      </Suspense>
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
  const autoRefreshEnabled = usePreferencesContext(
    (state) => state.projectsAutoRefreshEnabled
  );
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
      { id: projectId, timeRange },
      { fetchPolicy: "network-only" }
    );
    const subscription = observable.subscribe({
      next: (data) => {
        setProjectMetrics(data);
      },
      error: () => {
        setProjectMetrics(null);
      },
    });
    subscriptionRef.current = subscription;
    return subscription;
  }, [projectId, timeRange, environment]);
  // when the component mounts, or the time range changes, we fetch the project metrics
  useEffect(() => {
    subscriptionRef.current = fetchProject();
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [fetchProject]);
  // when the auto refresh is enabled, we refetch the project metrics every REFRESH_INTERVAL_MS
  // NOTE: this is bad, if the request takes longer than REFRESH_INTERVAL_MS, we can get into a loop of
  // refetching, cancelling, refetching, cancelling, etc.
  const refetchCallback = useCallback(() => {
    startTransition(() => {
      subscriptionRef.current?.unsubscribe();
      fetchProject();
    });
  }, [fetchProject]);
  useInterval(refetchCallback, autoRefreshEnabled ? REFRESH_INTERVAL_MS : null);
  // if the project metrics are not loaded yet, we show a loading indicator
  if (projectMetrics == null) {
    return (
      <Loading
        css={css`
          // stable height to avoid layout shifts
          min-height: var(--ac-global-dimension-size-600);
        `}
      />
    );
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
