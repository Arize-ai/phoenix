import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { formatDistance } from "date-fns";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@arizeai/components";

import { Link } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  ProjectsPageQuery,
  ProjectsPageQuery$data,
} from "./__generated__/ProjectsPageQuery.graphql";

export function ProjectsPage() {
  const data = useLazyLoadQuery<ProjectsPageQuery>(
    graphql`
      query ProjectsPageQuery {
        projects {
          edges {
            project: node {
              id
              name
              recordCount
              endTime
              latencyMsP50
              tokenCountTotal
            }
          }
        }
      }
    `,
    {}
  );
  const projects = data.projects.edges.map((p) => p.project);

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
                <ProjectItem project={project} />
              </Link>
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
  project: ProjectsPageQuery$data["projects"]["edges"][number]["project"];
}) {
  const { endTime, recordCount, tokenCountTotal, latencyMsP50 } = project;
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
      <Flex direction="row" gap="size-100" alignItems="center">
        <ProjectIcon />
        <Flex direction="column">
          <Heading level={2}>{project.name}</Heading>
          <Text color="text-700" textSize="small" fontStyle="italic">
            {lastUpdatedText}
          </Text>
        </Flex>
      </Flex>
      <Flex direction="row" justifyContent="space-between">
        <Flex direction="column" flex="none">
          {/* TODO swap out for number of traces */}
          <Text elementType="h3" textSize="medium" color="text-700">
            Total Spans
          </Text>
          <Text textSize="xlarge">{intFormatter(recordCount)}</Text>
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
