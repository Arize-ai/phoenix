import { Suspense } from "react";
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Input,
  Label,
  ListBox,
  Loading,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  TextField,
  View,
} from "@phoenix/components";
import { useProjectContext } from "@phoenix/contexts";

import { ProjectConfigPage_projectConfigCard$key } from "./__generated__/ProjectConfigPage_projectConfigCard.graphql";
import { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import { isProjectTab } from "./constants";
import { ProjectAnnotationConfigCard } from "./ProjectAnnotationConfigCard";
import {
  ProjectPageQueriesProjectConfigQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import { ProjectRetentionPolicyCard } from "./ProjectRetentionPolicyCard";
const projectConfigPageCSS = css`
  overflow-y: auto;
`;

const projectConfigPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const gradientPreviewCSS = css`
  width: 75px;
  height: 75px;
  flex: none;
  border-radius: 50%;
  margin-top: var(--ac-global-dimension-size-100);
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
  const data = usePreloadedQuery(ProjectPageQueriesProjectConfigQuery, project);
  return (
    <Flex direction="column" gap="size-200">
      <ProjectConfigCard project={data.project} />
      <ProjectAnnotationConfigCard projectId={data.project.id} />
      <ProjectRetentionPolicyCard project={data.project} query={data} />
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
      }
    `,
    project
  );

  const { defaultTab, setDefaultTab } = useProjectContext((state) => ({
    defaultTab: state.defaultTab,
    setDefaultTab: state.setDefaultTab,
  }));

  return (
    <Card title="Project Settings">
      <View padding="size-200">
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
              <Flex
                direction="row"
                gap="size-100"
                alignItems="end"
                width="100%"
              >
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
              <Select
                value={defaultTab}
                onChange={(key) => {
                  if (typeof key === "string" && isProjectTab(key)) {
                    setDefaultTab(key);
                  }
                }}
                placeholder="Select a default tab"
              >
                <Label>Default Project Tab</Label>
                <Button>
                  <SelectValue />
                  <SelectChevronUpDownIcon />
                </Button>
                <Popover>
                  <ListBox>
                    <SelectItem key="spans" id="spans">
                      Spans
                    </SelectItem>
                    <SelectItem key="traces" id="traces">
                      Traces
                    </SelectItem>
                    <SelectItem key="sessions" id="sessions">
                      Sessions
                    </SelectItem>
                    <SelectItem key="metrics" id="metrics">
                      Metrics
                    </SelectItem>
                  </ListBox>
                </Popover>
              </Select>
            </Flex>
          </div>
        </Flex>
      </View>
    </Card>
  );
};
