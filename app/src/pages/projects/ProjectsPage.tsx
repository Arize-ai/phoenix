import React, {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import { formatDistance } from "date-fns";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Text,
  useNotification,
  View,
} from "@arizeai/components";

import { Link, Loading } from "@phoenix/components";
import {
  ConnectedLastNTimeRangePicker,
  useLastNTimeRange,
} from "@phoenix/components/datetime";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useInterval } from "@phoenix/hooks/useInterval";
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

const REFRESH_INTERVAL_MS = 10000;
const PAGE_SIZE = 50;

export function ProjectsPage() {
  const { timeRange } = useLastNTimeRange();

  return (
    <Suspense fallback={<Loading />}>
      <ProjectsPageContent timeRange={timeRange} />
    </Suspense>
  );
}

export function ProjectsPageContent({ timeRange }: { timeRange: TimeRange }) {
  const autoRefreshEnabled = usePreferencesContext(
    (state) => state.projectsAutoRefreshEnabled
  );
  const [notify, holder] = useNotification();
  // Convert the time range to a variable that can be used in the query
  const timeRangeVariable = useMemo(() => {
    return {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    };
  }, [timeRange]);

  const data = useLazyLoadQuery<ProjectsPageQuery>(
    graphql`
      query ProjectsPageQuery($timeRange: TimeRange!) {
        ...ProjectsPageProjectsFragment
      }
    `,
    {
      timeRange: timeRangeVariable,
    }
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
              traceCount(timeRange: $timeRange)
              endTime
              latencyMsP50: latencyMsQuantile(
                probability: 0.5
                timeRange: $timeRange
              )
              tokenCountTotal(timeRange: $timeRange)
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
                to={`/projects/${project.id}`}
                css={css`
                  text-decoration: none;
                `}
              >
                <ProjectItem
                  project={project}
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
};
function ProjectItem({
  project,
  onProjectDelete,
  onProjectClear,
  onProjectRemoveData,
}: ProjectItemProps) {
  const {
    endTime,
    traceCount,
    tokenCountTotal,
    latencyMsP50,
    gradientStartColor,
    gradientEndColor,
  } = project;
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
        border-radius: var(--ac-global-rounding-medium);
        height: var(--ac-global-dimension-size-1250);
        width: var(--ac-global-dimension-size-3600);
        transition: border-color 0.2s;
        &:hover {
          border-color: var(--ac-global-color-primary);
        }
        display: flex;
        flex-direction: column;
        justify-content: space-between;
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
            <Text color="text-700" textSize="small" fontStyle="italic">
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

      <Flex direction="row" justifyContent="space-between">
        <Flex direction="column" flex="none">
          <Text elementType="h3" textSize="medium" color="text-700">
            Total Traces
          </Text>
          <Text textSize="xlarge">{intFormatter(traceCount)}</Text>
        </Flex>
        <Flex direction="column" flex="none">
          <Text elementType="h3" textSize="medium" color="text-700">
            Total Tokens
          </Text>
          <Text textSize="xlarge">{intFormatter(tokenCountTotal)}</Text>
        </Flex>
        <Flex direction="column" flex="none">
          <Text elementType="h3" textSize="medium" color="text-700">
            Latency P50
          </Text>
          {latencyMsP50 != null ? (
            <LatencyText latencyMs={latencyMsP50} textSize="xlarge" />
          ) : (
            <Text textSize="xlarge">--</Text>
          )}
        </Flex>
      </Flex>
    </div>
  );
}
