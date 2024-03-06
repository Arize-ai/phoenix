import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert, Flex, View } from "@arizeai/components";

import { Link } from "@phoenix/components";

import { ProjectsPageQuery } from "./__generated__/ProjectsPageQuery.graphql";

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
            }
          }
        }
      }
    `,
    {}
  );
  return (
    <Flex direction="column" flex="1 1 auto">
      <Alert variant="info" banner title="🚧 Under Construction">
        Projects are currently under construction. Navigate to your{" "}
        <Link to="/projects/default">default project</Link>
      </Alert>
      <View padding="size-200">
        <Link to="/projects/default">Go to your default project</Link>
        <ul>
          {data.projects.edges.map((projectEdge) => (
            <li key={projectEdge.project.id}>
              <Link to={`/projects/${projectEdge.project.id}`}>
                <View
                  padding="size-200"
                  width="size-2400"
                  height="size-800"
                  borderWidth="thin"
                  borderColor="light"
                  borderRadius="medium"
                >
                  {projectEdge.project.name}
                </View>
              </Link>
            </li>
          ))}
        </ul>
      </View>
    </Flex>
  );
}
