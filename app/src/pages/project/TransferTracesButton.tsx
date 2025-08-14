import { Suspense, useMemo, useTransition } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";

import {
  Autocomplete,
  Button,
  DebouncedSearch,
  Dialog,
  DialogTrigger,
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

import { TransferTracesButton_projects$key } from "./__generated__/TransferTracesButton_projects.graphql";
import { TransferTracesButtonProjectsQuery } from "./__generated__/TransferTracesButtonProjectsQuery.graphql";

export function TransferTracesButton() {
  const onProjectSelect = (projectName: string) => {
    alert(projectName);
  };
  return (
    <DialogTrigger>
      <Button leadingVisual={<Icon svg={<Icons.CornerUpRightOutline />} />}>
        Transfer Project
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
}: {
  onProjectSelect: (projectId: string) => void;
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
    <Dialog>
      <ProjectsList query={query} onProjectSelect={onProjectSelect} />
    </Dialog>
  );
}

function ProjectsList({
  query,
  onProjectSelect,
}: {
  query: TransferTracesButton_projects$key;
  onProjectSelect: (projectId: string) => void;
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
      refetch({
        search: search,
      });
    });
  };
  return (
    <Autocomplete filter={contains}>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderBottomColor="light"
      >
        <DebouncedSearch
          autoFocus
          aria-label="Search projects"
          placeholder="Search projects..."
          onChange={onSearchChange}
        />
      </View>
      <ListBox
        aria-label="projects"
        items={items}
        selectionMode="single"
        onSelectionChange={(selection) => {
          if (selection === "all") {
            return;
          }
          const projectId = selection.keys().next().value;
          if (typeof projectId === "string") {
            onProjectSelect(projectId);
          }
        }}
      >
        {(item) => (
          <ListBoxItem key={item.id} id={item.id}>
            {item.name}
          </ListBoxItem>
        )}
      </ListBox>
    </Autocomplete>
  );
}
