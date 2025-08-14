<<<<<<< HEAD
import { Suspense, useMemo, useTransition } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";

import {
  Button,
  DebouncedSearch,
=======
import {
  Button,
>>>>>>> b0a2dcfe9f7a86bed06c6c9999e585c18ae9800e
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
<<<<<<< HEAD
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";

import { TransferTracesButton_projects$key } from "./__generated__/TransferTracesButton_projects.graphql";
import { TransferTracesButtonProjectsQuery } from "./__generated__/TransferTracesButtonProjectsQuery.graphql";

=======
  Input,
  Popover,
  PopoverArrow,
  SearchField,
  SearchIcon,
  View,
} from "@phoenix/components";

>>>>>>> b0a2dcfe9f7a86bed06c6c9999e585c18ae9800e
export function TransferTracesButton() {
  return (
    <DialogTrigger>
      <Button leadingVisual={<Icon svg={<Icons.CornerUpRightOutline />} />}>
        Transfer Project
      </Button>
      <Popover>
        <PopoverArrow />
        <Dialog>
<<<<<<< HEAD
          <Suspense fallback={<Loading />}>
            <ProjectSelectionDialogContent />
          </Suspense>
=======
          <ProjectSelection />
>>>>>>> b0a2dcfe9f7a86bed06c6c9999e585c18ae9800e
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

<<<<<<< HEAD
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
=======
function ProjectSelection() {
  return (
    <View minWidth={400} minHeight={500} padding="size-100">
      <SearchField>
        <SearchIcon />
        <Input placeholder="Search Projects" />
      </SearchField>
>>>>>>> b0a2dcfe9f7a86bed06c6c9999e585c18ae9800e
    </View>
  );
}
