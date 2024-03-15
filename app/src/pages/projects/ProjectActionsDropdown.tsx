import React, { useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { Button, DropdownTrigger, Icon, Icons } from "@arizeai/components";
import { Flex, Text } from "@arizeai/components";

import { useProjectState } from "@phoenix/contexts/ProjectStateContext";

import { ProjectActionsDropdownMutation } from "./__generated__/ProjectActionsDropdownMutation.graphql";
import { ProjectsPageProjectsFragment$data } from "./__generated__/ProjectsPageProjectsFragment.graphql";

type ProjectActionDropdownProps = {
  project: ProjectsPageProjectsFragment$data["projects"]["edges"][number]["project"];
};
export function ProjectActionsDropdown({
  project,
}: ProjectActionDropdownProps) {
  const [commit] = useMutation<ProjectActionsDropdownMutation>(graphql`
    mutation ProjectActionsDropdownMutation($projectId: GlobalID!) {
      deleteProject(id: $projectId) {
        ...ProjectsPageProjectsFragment
      }
    }
  `);
  // const { incrementFetchKey } = useProjectState();
  const handleDelete = useCallback(() => {
    commit({
      variables: {
        projectId: project.id,
      },
    });
  }, [commit, project]);

  return (
    <DropdownTrigger placement="bottom right">
      <ProjectActionsMenuButton />
      <ProjectDeleteActionButton handleDelete={handleDelete} />
    </DropdownTrigger>
  );
}

function ProjectActionsMenuButton() {
  return (
    <Button
      variant={"quiet"}
      size="compact"
      icon={<Icon svg={<Icons.MoreHorizontalOutline />} />}
      aria-label="Project Actions Menu"
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

function ProjectDeleteActionButton({
  handleDelete,
}: {
  handleDelete: () => void;
}) {
  return (
    <div
      css={css`
        border: 1px solid var(--ac-global-color-grey-400);
        border-radius: var(--ac-global-rounding-medium);
        background-color: var(--ac-global-color-grey-100);
        width: var(--ac-global-dimension-size-1600);
        display: flex;
      `}
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Button
        variant="quiet"
        css={css`
          border-radius: var(--ac-global-rounding-medium);
          display: flex;
          justify-content: start;
          flex: 1;
        `}
        aria-label="Delete Project Button"
        onClick={handleDelete}
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
  );
}
