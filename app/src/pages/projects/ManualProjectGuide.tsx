import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import type { ManualProjectGuideCreateProjectMutation } from "./__generated__/ManualProjectGuideCreateProjectMutation.graphql";
import { NewProjectForm, ProjectFormParams } from "./NewProjectForm";

export function ManualProjectGuide({
  refetchProjects,
}: {
  refetchProjects: () => void;
}) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [commit, isCommitting] =
    useMutation<ManualProjectGuideCreateProjectMutation>(graphql`
      mutation ManualProjectGuideCreateProjectMutation(
        $input: CreateProjectInput!
      ) {
        createProject(input: $input) {
          project {
            id
            name
            gradientStartColor
            gradientEndColor
            createdAt
          }
          query {
            projects(first: 50) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `);

  const onSubmit = useCallback(
    (params: ProjectFormParams) => {
      commit({
        variables: {
          input: {
            name: params.name,
            description: params.description,
            gradientStartColor: params.gradientStartColor,
            gradientEndColor: params.gradientEndColor,
          },
        },
        onCompleted: (response) => {
          const createdProject = response.createProject.project;
          notifySuccess({
            title: "Project created",
            message: `Project "${createdProject.name}" has been successfully created.`,
          });
          refetchProjects();
          // Navigate to the project page
          navigate(`/projects/${createdProject.id}`);
        },
        onError: () => {
          notifyError({
            title: "Failed to create project",
            message:
              "This is likely due to a naming conflict. Please try a different name.",
          });
        },
      });
    },
    [commit, notifySuccess, notifyError, navigate, refetchProjects]
  );

  return (
    <NewProjectForm
      onSubmit={onSubmit}
      isSubmitting={isCommitting}
      submitButtonText={isCommitting ? "Creating..." : "Create Project"}
    />
  );
}
