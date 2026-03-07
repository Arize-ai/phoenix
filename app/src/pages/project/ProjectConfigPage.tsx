import { css } from "@emotion/react";
import { Suspense, useCallback, useState } from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  useMutation,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";

import {
  Alert,
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
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
import { useNotifySuccess, useProjectContext } from "@phoenix/contexts";

import type { ProjectFormParams } from "../projects/ProjectForm";
import { GRADIENT_PRESETS, ProjectForm } from "../projects/ProjectForm";
import type { ProjectConfigPage_projectConfigCard$key } from "./__generated__/ProjectConfigPage_projectConfigCard.graphql";
import type { ProjectConfigPagePatchProjectMutation } from "./__generated__/ProjectConfigPagePatchProjectMutation.graphql";
import type { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
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
  padding: var(--global-dimension-size-400);
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
  margin-top: var(--global-dimension-size-100);
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

/**
 * Find matching gradient preset from start/end colors, or default to first preset.
 */
function findGradientPreset(startColor: string, endColor: string): string {
  const match = GRADIENT_PRESETS.find(
    (p) =>
      p.startColor.toLowerCase() === startColor.toLowerCase() &&
      p.endColor.toLowerCase() === endColor.toLowerCase()
  );
  return match?.id ?? GRADIENT_PRESETS[0].id;
}

const nameFieldCSS = css`
  width: 100%;
`;

const ReadOnlyNameField = ({ name }: { name: string }) => (
  <Flex direction="row" gap="size-100" alignItems="end" width="100%">
    <TextField value={name} isReadOnly css={nameFieldCSS}>
      <Label>Project Name</Label>
      <Input />
    </TextField>
    <CopyToClipboardButton text={name} size="M" />
  </Flex>
);

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
        description
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

  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();

  const [commit, isCommitting] =
    useMutation<ProjectConfigPagePatchProjectMutation>(graphql`
      mutation ProjectConfigPagePatchProjectMutation($input: PatchProjectInput!) {
        patchProject(input: $input) {
          project {
            id
            description
            gradientStartColor
            gradientEndColor
          }
        }
      }
    `);

  const handleSubmit = useCallback(
    (params: ProjectFormParams) => {
      setError(null);
      commit({
        variables: {
          input: {
            id: data.id,
            description: params.description,
            gradientStartColor: params.gradientStartColor,
            gradientEndColor: params.gradientEndColor,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Project updated",
            message: "Project settings have been saved.",
          });
          setIsEditing(false);
        },
        onError: () => {
          setError("An error occurred while saving project settings.");
        },
      });
    },
    [commit, data.id, notifySuccess]
  );

  if (isEditing) {
    return (
      <Card title="Project Settings">
        {error && (
          <View padding="size-200" paddingBottom="size-0">
            <Alert variant="danger" banner>
              {error}
            </Alert>
          </View>
        )}
        <View padding="size-200">
          <ReadOnlyNameField name={data.name} />
        </View>
        <ProjectForm
          onSubmit={handleSubmit}
          isSubmitting={isCommitting}
          submitButtonText={isCommitting ? "Saving..." : "Save"}
          hideNameField
          onCancel={() => {
            setIsEditing(false);
            setError(null);
          }}
          defaultValues={{
            description: data.description ?? "",
            gradientPreset: findGradientPreset(
              data.gradientStartColor,
              data.gradientEndColor
            ),
          }}
        />
      </Card>
    );
  }

  return (
    <Card
      title="Project Settings"
      extra={
        <Button
          variant="default"
          size="S"
          leadingVisual={<Icon svg={<Icons.EditOutline />} />}
          onPress={() => setIsEditing(true)}
        >
          Edit
        </Button>
      }
    >
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
              .dropdown,
              .dropdown__button {
                width: 100%;
              }
            `}
          >
            <Flex direction="column" gap="size-100" width="100%">
              <ReadOnlyNameField name={data.name} />
              {data.description && (
                <TextField value={data.description} isReadOnly>
                  <Label>Description</Label>
                  <Input />
                </TextField>
              )}
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
