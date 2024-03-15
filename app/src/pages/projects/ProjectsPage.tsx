import React, { useMemo } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRefetchableFragment,
} from "react-relay";
import { formatDistance } from "date-fns";
import { css } from "@emotion/react";

import { Button, DropdownTrigger, Icon, Icons } from "@arizeai/components";
import { Flex, Heading, Text, View } from "@arizeai/components";

import { Link } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { ProjectsPageDeleteProjectMutation } from "./__generated__/ProjectsPageDeleteProjectMutation.graphql";
import {
  ProjectsPageProjectsFragment$data,
  ProjectsPageProjectsFragment$key,
} from "./__generated__/ProjectsPageProjectsFragment.graphql";
import { ProjectsPageProjectsQuery } from "./__generated__/ProjectsPageProjectsQuery.graphql";
import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";

export function ProjectsPage() {
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
              {/* <Link
                to={`/projects/${project.id}`}
                css={css`
                  text-decoration: none;
                `}
              > */}
              <ProjectItem project={project} />
              {/* </Link> */}
            </li>
          ))}
        </ul>
      </View>
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
      `}
    />
  );
}
function ProjectItem({
  project,
}: {
  project: ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"];
}) {
  const [commit] = useMutation<ProjectsPageDeleteProjectMutation>(graphql`
    mutation ProjectsPageDeleteProjectMutation($id: GlobalID!) {
      deleteProject(id: $id) {
        ...ProjectsPageProjectsFragment
      }
    }
  `);
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
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Flex direction="row" gap="size-100" alignItems="center">
          <ProjectIcon />
          <Flex direction="column">
            <Heading level={2}>{project.name}</Heading>
            <Text color="text-700" textSize="small" fontStyle="italic">
              {lastUpdatedText}
            </Text>
          </Flex>
        </Flex>
        <DropdownTrigger placement="bottom left">
          <Button
            variant={"quiet"}
            size="compact"
            icon={<Icon svg={<Icons.MoreHorizontalOutline />} />}
            aria-label="Project Menu"
          />
          <div
            css={css`
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              width: var(--ac-global-dimension-size-1600);
              border-radius: var(--ac-global-rounding-medium);
              display: flex;
              flex-direction: row;
            `}
          >
            <Button
              variant="quiet"
              css={css`
                padding: 0px;
                border-radius: var(--ac-global-rounding-medium);
                display: flex;
                flex-direction: row;
                justify-content: start;
                flex: 1;
              `}
              onClick={() => {
                commit({
                  variables: {
                    id: project.id,
                  },
                });
              }}
            >
              <Flex
                direction={"row"}
                gap="5px"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.TrashOutline />} />
                <Text>Delete</Text>
              </Flex>
            </Button>
          </div>
        </DropdownTrigger>
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
