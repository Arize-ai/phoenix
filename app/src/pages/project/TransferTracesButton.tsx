import { Suspense, useMemo, useTransition } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";

import {
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
  View,
} from "@phoenix/components";

import { TransferTracesButton_projects$key } from "./__generated__/TransferTracesButton_projects.graphql";
import { TransferTracesButtonProjectsQuery } from "./__generated__/TransferTracesButtonProjectsQuery.graphql";

export function TransferTracesButton() {
  return (
    <DialogTrigger>
      <Button leadingVisual={<Icon svg={<Icons.CornerUpRightOutline />} />}>
        Transfer Project
      </Button>
      <Popover>
        <PopoverArrow />
        <Dialog>
          <Suspense fallback={<Loading />}>
            <ProjectSelectionDialogContent />
          </Suspense>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function ProjectSelectionDialogContent() {
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
      <ProjectsList query={query} />
    </Dialog>
  );
}

function ProjectsList({ query }: { query: TransferTracesButton_projects$key }) {
  const [, startTransition] = useTransition();
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
    <View>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderBottomColor="light"
      >
        <DebouncedSearch
          aria-label="Search projects"
          placeholder="Search projects..."
          onChange={onSearchChange}
        />
      </View>
      <ListBox aria-label="projects" items={items} selectionMode="single">
        {(item) => (
          <ListBoxItem key={item.id} id={item.id}>
            {item.name}
          </ListBoxItem>
        )}
      </ListBox>
    </View>
  );
}
