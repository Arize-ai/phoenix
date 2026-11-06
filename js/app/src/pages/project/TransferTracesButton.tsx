import { Suspense } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Loading,
  Popover,
  PopoverArrow,
} from "@phoenix/components";
import {
  ProjectSelectionMenu,
  useAllProjects,
} from "@phoenix/components/project";
import type { TransferTracesButtonTransferMutation } from "@phoenix/pages/project/__generated__/TransferTracesButtonTransferMutation.graphql";

export function TransferTracesButton({
  traceIds,
  currentProjectId,
  onSuccess,
  onError,
}: {
  traceIds: string[];
  currentProjectId: string;
  onSuccess: (project: { projectName: string; projectId: string }) => void;
  onError: (error: Error) => void;
}) {
  const [transferTraces, isTransferring] =
    useMutation<TransferTracesButtonTransferMutation>(graphql`
      mutation TransferTracesButtonTransferMutation(
        $projectId: ID!
        $traceIds: [ID!]!
      ) {
        transferTracesToProject(traceIds: $traceIds, projectId: $projectId) {
          project: node(id: $projectId) {
            id
            ... on Project {
              name
            }
          }
        }
      }
    `);

  const onProjectSelect = (projectId: string) => {
    transferTraces({
      variables: { traceIds, projectId },
      onCompleted: (response) => {
        const destinationProjectName =
          response.transferTracesToProject.project?.name || "unknown";
        onSuccess({
          projectName: destinationProjectName,
          projectId,
        });
      },
      onError: (error) => {
        onError(error);
      },
    });
  };
  return (
    <DialogTrigger>
      <Button
        leadingVisual={<Icon svg={<Icons.ArrowUpRightCorner />} />}
        isDisabled={isTransferring}
      >
        {isTransferring ? "Transferring" : "Transfer"}
      </Button>
      <Popover>
        <PopoverArrow />
        <Suspense fallback={<Loading />}>
          <TransferProjectPicker
            currentProjectId={currentProjectId}
            onProjectSelect={onProjectSelect}
          />
        </Suspense>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A searchable list of projects that traces can be transferred to. The
 * current project is shown but disabled since transferring to it is a no-op.
 */
function TransferProjectPicker({
  onProjectSelect,
  currentProjectId,
}: {
  onProjectSelect: (projectId: string) => void;
  currentProjectId: string;
}) {
  const projects = useAllProjects();

  return (
    <ProjectSelectionMenu
      label="Transfer Traces to Project"
      projects={projects}
      onProjectSelect={onProjectSelect}
      disabledProjectIds={[currentProjectId]}
    />
  );
}
