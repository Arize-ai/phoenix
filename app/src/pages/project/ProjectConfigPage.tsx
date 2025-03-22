import React, { Suspense } from "react";
import { graphql, PreloadedQuery, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import { Flex, Loading } from "@phoenix/components";

import { ProjectPageProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageProjectConfigQuery.graphql";
import { useProjectPageQueryReferenceContext } from "./ProjectPageQueries";

const projectConfigPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const projectConfigPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-200);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  height: 100%;
`;

export const ProjectConfigPage = () => {
  const { projectConfigQueryReference } = useProjectPageQueryReferenceContext();
  if (!projectConfigQueryReference) {
    return null;
  }
  return (
    <main css={projectConfigPageCSS}>
      <div css={projectConfigPageInnerCSS}>
        <Suspense fallback={<Loading />}>
          <ProjectConfigContent project={projectConfigQueryReference} />
        </Suspense>
      </div>
    </main>
  );
};

const ProjectConfigContent = ({
  project,
}: {
  project: PreloadedQuery<ProjectPageProjectConfigQueryType>;
}) => {
  const [data, refetch] = useRefetchableFragment(
    graphql`
      fragment ProjectConfigPage_project on Project
      @refetchable(queryName: "ProjectConfigPageRefetchQuery") {
        name
      }
    `,
    project
  );
  return (
    <Flex direction="column" gap="size-200">
      <Card title="Project Settings" variant="compact">
        Project settings here
      </Card>
    </Flex>
  );
};
