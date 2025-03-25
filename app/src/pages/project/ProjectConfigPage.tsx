import React, { Suspense } from "react";
<<<<<<< HEAD
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";
import { css } from "@emotion/react";

import { Card, Item, Picker } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Input,
  Label,
  Loading,
  TextField,
} from "@phoenix/components";
import { useProjectContext } from "@phoenix/contexts";

import { ProjectConfigPage_projectConfigCard$key } from "./__generated__/ProjectConfigPage_projectConfigCard.graphql";
import { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import { isProjectTab } from "./constants";
import {
  ProjectPageQueriesProjectConfigQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
const projectConfigPageCSS = css`
  overflow-y: auto;
`;

const projectConfigPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
=======
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
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
<<<<<<< HEAD
`;

const gradientPreviewCSS = css`
  width: 75px;
  height: 75px;
  flex: none;
  border-radius: 50%;
  margin-top: var(--ac-global-dimension-size-100);
=======
  height: 100%;
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
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
<<<<<<< HEAD
  const data = usePreloadedQuery(ProjectPageQueriesProjectConfigQuery, project);
  return (
    <Flex direction="column" gap="size-200">
      <ProjectConfigCard project={data.project} />
    </Flex>
  );
};

const ProjectConfigCard = ({
  project,
}: {
  project: ProjectConfigPage_projectConfigCard$key;
}) => {
  const [data] = useRefetchableFragment(
    graphql`
      fragment ProjectConfigPage_projectConfigCard on Project
      @refetchable(queryName: "ProjectConfigPageProjectConfigCardQuery") {
        id
        name
        gradientStartColor
        gradientEndColor
=======
  const [data, refetch] = useRefetchableFragment(
    graphql`
      fragment ProjectConfigPage_project on Project
      @refetchable(queryName: "ProjectConfigPageRefetchQuery") {
        name
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
      }
    `,
    project
  );
<<<<<<< HEAD

  const { defaultTab, setDefaultTab } = useProjectContext((state) => ({
    defaultTab: state.defaultTab,
    setDefaultTab: state.setDefaultTab,
  }));

  return (
    <Card title="Project Settings" variant="compact">
      <Flex direction="row" gap="size-200">
        <div
          css={[
            gradientPreviewCSS,
            {
              background: `linear-gradient(136.27deg, ${data.gradientStartColor} 14.03%, ${data.gradientEndColor} 84.38%)`,
            },
          ]}
        />
        <div
          css={css`
            width: 100%;
            .ac-dropdown,
            .ac-dropdown-button {
              width: 100%;
            }
          `}
        >
          <Flex direction="column" gap="size-100" width="100%">
            <Flex direction="row" gap="size-100" alignItems="end" width="100%">
              <TextField
                value={data.name}
                isReadOnly
                css={css`
                  width: 100%;
                `}
              >
                <Label>Project Name</Label>
                <Input />
              </TextField>
              <CopyToClipboardButton text={data.name} size="M" />
            </Flex>
            <Picker
              label="Default Project Tab"
              selectedKey={defaultTab}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isProjectTab(key)) {
                  setDefaultTab(key);
                }
              }}
              size="default"
              placeholder="Select a default tab"
            >
              <Item key="spans">Spans</Item>
              <Item key="traces">Traces</Item>
              <Item key="sessions">Sessions</Item>
            </Picker>
          </Flex>
        </div>
      </Flex>
    </Card>
=======
  return (
    <Flex direction="column" gap="size-200">
      <Card title="Project Settings" variant="compact">
        Project settings here
      </Card>
    </Flex>
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
  );
};
