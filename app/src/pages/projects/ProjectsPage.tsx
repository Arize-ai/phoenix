import React, { startTransition, useCallback, useMemo } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { formatDistance } from "date-fns";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Text,
  useNotification,
  View,
} from "@arizeai/components";

import { Link } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useInterval } from "@phoenix/hooks/useInterval";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ProjectsPageProjectsFragment$data,
  ProjectsPageProjectsFragment$key,
} from "./__generated__/ProjectsPageProjectsFragment.graphql";
import { ProjectsPageProjectsQuery } from "./__generated__/ProjectsPageProjectsQuery.graphql";
import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";
import { ProjectActionMenu } from "./ProjectActionMenu";

const REFRESH_INTERVAL_MS = 3000;

export function ProjectsPage() {
  const [notify, holder] = useNotification();
  const data = useLazyLoadQuery<ProjectsPageQuery>(
    graphql`
      query ProjectsPageQuery {
        ...ProjectsPageProjectsFragment
      }
    `,
    {}
  );
  const [projectsData, refetch] = useRefetchableFragment<
    ProjectsPageProjectsQuery,
    ProjectsPageProjectsFragment$key
  >(
    graphql`
      fragment ProjectsPageProjectsFragment on Query
      @refetchable(queryName: "ProjectsPageProjectsQuery") {
        projects {
          edges {
            project: node {
              id
              name
              traceCount
              endTime
              latencyMsP50
              tokenCountTotal
            }
          }
        }
      }
    `,
    data
  );
  const projects = projectsData.projects.edges.map((p) => p.project);

  useInterval(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, REFRESH_INTERVAL_MS);

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

  return (
    <Flex direction="column" flex="1 1 auto">
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
                  canDelete={project.name !== "default"} // the default project cannot be deleted
                  onProjectDelete={() => onDelete(project.name)}
                />
              </Link>
            </li>
          ))}
        </ul>
      </View>
      {holder}
    </Flex>
  );
}

function ProjectIcon() {
  return (
    <div
      css={css`
        border-radius: 50%;
        width: 32px;
        height: 32px;
        background: linear-gradient(
          136.27deg,
          rgb(91, 219, 255) 14.03%,
          rgb(28, 118, 252) 84.38%
        );
        flex-shrink: 0;
      `}
    />
  );
}
type ProjectItemProps = {
  project: ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"];
  canDelete: boolean;
  onProjectDelete: () => void;
};
function ProjectItem({
  project,
  canDelete,
  onProjectDelete,
}: ProjectItemProps) {
  const { endTime, traceCount, tokenCountTotal, latencyMsP50 } = project;
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
          <ProjectIcon />
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
        {canDelete && (
          <ProjectActionMenu
            projectId={project.id}
            projectName={project.name}
            onProjectDelete={onProjectDelete}
          />
        )}
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
