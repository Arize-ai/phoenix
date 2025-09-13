import { Suspense, useMemo, useTransition } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRefetchableFragment,
} from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  DebouncedSearch,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  PopoverArrow,
  useFilter,
  View,
} from "@phoenix/components";
import { TransferTracesButtonTransferMutation } from "@phoenix/pages/project/__generated__/TransferTracesButtonTransferMutation.graphql";

import { TransferTracesButton_projects$key } from "./__generated__/TransferTracesButton_projects.graphql";
import { TransferTracesButtonProjectsQuery } from "./__generated__/TransferTracesButtonProjectsQuery.graphql";

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
        leadingVisual={<Icon svg={<Icons.CornerUpRightOutline />} />}
        isDisabled={isTransferring}
      >
        {isTransferring ? "Transferring" : "Transfer"}
      </Button>
      <Popover>
        <PopoverArrow />
        <Dialog>
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              <ProjectSelectionDialogContent
                onProjectSelect={(projectId: string) => {
                  onProjectSelect(projectId);
                  close();
                }}
                currentProjectId={currentProjectId}
              />
            </Suspense>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function ProjectSelectionDialogContent({
  onProjectSelect,
  currentProjectId,
}: {
  onProjectSelect: (projectId: string) => void;
  currentProjectId: string;
}) {
  const query = useLazyLoadQuery<TransferTracesButtonProjectsQuery>(
    graphql`
      query TransferTracesButtonQuery {
        ...TransferTracesButton_projects @arguments(search: "")
      }
    `,
    { search: "" }
  );
  return (
    <ProjectsList
      query={query}
      onProjectSelect={onProjectSelect}
      currentProjectId={currentProjectId}
    />
  );
}

function ProjectsList({
  query,
  onProjectSelect,
  currentProjectId,
}: {
  query: TransferTracesButton_projects$key;
  onProjectSelect: (projectId: string) => void;
  currentProjectId: string;
}) {
  const [, startTransition] = useTransition();
  const { contains } = useFilter({ sensitivity: "base" });
  const [data, refetch] = useRefetchableFragment<
    TransferTracesButtonProjectsQuery,
    TransferTracesButton_projects$key
  >(
    graphql`
      fragment TransferTracesButton_projects on Query
      @refetchable(queryName: "TransferTracesButtonProjectsQuery")
      @argumentDefinitions(search: { type: "String!" }) {
        projects(filter: { col: name, value: $search }) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
    query
  );
  const items = useMemo(() => {
    return data.projects.edges.map((edge) => edge.node);
  }, [data]);

  const onSearchChange = (search: string) => {
    startTransition(() => {
      refetch({ search });
    });
  };
  return (
    <Autocomplete filter={contains}>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Heading level={4} weight="heavy">
            Transfer Traces to Project
          </Heading>
          <DebouncedSearch
            autoFocus
            aria-label="Search projects"
            placeholder="Search projects..."
            onChange={onSearchChange}
          />
        </Flex>
      </View>
      <ListBox
        aria-label="projects"
        items={items}
        selectionMode="single"
        css={css`
          height: 300px;
        `}
        onSelectionChange={(selection) => {
          if (selection === "all") {
            return;
          }
          const projectId = selection.keys().next().value;
          if (typeof projectId === "string") {
            onProjectSelect(projectId);
          }
        }}
        renderEmptyState={() => "No projects found"}
      >
        {(item) => (
          <ListBoxItem
            key={item.id}
            id={item.id}
            isDisabled={item.id === currentProjectId}
          >
            {item.name}
          </ListBoxItem>
        )}
      </ListBox>
    </Autocomplete>
  );
}
