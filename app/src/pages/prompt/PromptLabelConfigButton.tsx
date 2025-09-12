import { Suspense, useState } from "react";
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
  ColorSwatch,
  DebouncedSearch,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  PopoverArrow,
  type Selection,
  View,
} from "@phoenix/components";
import {
  PromptLabelConfigButton_labels$data,
  PromptLabelConfigButton_labels$key,
} from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_labels.graphql";
import { PromptLabelConfigButtonQuery } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonQuery.graphql";
import { PromptLabelConfigButtonSetLabelsMutation } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonSetLabelsMutation.graphql";

import { NewPromptLabelDialog } from "./NewPromptLabelDialog";

type PromptLabelConfigButtonProps = {
  promptId: string;
};

export function PromptLabelConfigButton(props: PromptLabelConfigButtonProps) {
  const { promptId } = props;
  const [showNewLabelDialog, setShowNewLabelDialog] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <DialogTrigger
        isOpen={isOpen && !showNewLabelDialog}
        onOpenChange={(newIsOpen) => setIsOpen(newIsOpen)}
      >
        <Button
          variant="quiet"
          size="S"
          leadingVisual={
            <Icon svg={<Icon svg={<Icons.SettingsOutline />} />} />
          }
          aria-label="Edit prompt labels"
        />
        <Popover>
          <PopoverArrow />
          <Dialog>
            <Suspense fallback={<Loading />}>
              <PromptLabelSelectionDialogContent
                promptId={promptId}
                onNewLabelPress={() => {
                  setShowNewLabelDialog(true);
                }}
              />
            </Suspense>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {showNewLabelDialog ? (
        <NewPromptLabelDialog
          onCompleted={() => setShowNewLabelDialog(false)}
          onError={(error) => {
            alert(
              "Failed to create the label due to an error. Please try again. Error: " +
                error.message
            );
          }}
        />
      ) : null}
    </>
  );
}

function PromptLabelSelectionDialogContent(props: {
  promptId: string;
  onNewLabelPress: () => void;
}) {
  const { promptId } = props;
  const query = useLazyLoadQuery<PromptLabelConfigButtonQuery>(
    graphql`
      query PromptLabelConfigButtonQuery($promptId: ID!) {
        ...PromptLabelConfigButton_labels @arguments(promptId: $promptId)
      }
    `,
    { promptId }
  );

  return <PromptLabelList query={query} {...props} />;
}
function PromptLabelList({
  promptId,
  query,
  onNewLabelPress,
}: {
  promptId: string;
  query: PromptLabelConfigButton_labels$key;
  onNewLabelPress: () => void;
}) {
  const [data] = useRefetchableFragment(
    graphql`
      fragment PromptLabelConfigButton_labels on Query
      @refetchable(queryName: "PromptLabelConfigButtonLabelsQuery")
      @argumentDefinitions(promptId: { type: "ID!" }) {
        prompt: node(id: $promptId) {
          ... on Prompt {
            labels {
              id
            }
          }
        }
        promptLabels {
          edges {
            node {
              id
              name
              color
            }
          }
        }
      }
    `,
    query
  );
  const selectedLabelIds = data.prompt?.labels?.map((label) => label.id) || [];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  const [setPromptLabel] =
    useMutation<PromptLabelConfigButtonSetLabelsMutation>(graphql`
      mutation PromptLabelConfigButtonSetLabelsMutation(
        $newPromptLabelsDef: SetPromptLabelsInput!
        $promptId: ID!
      ) {
        setPromptLabels(input: $newPromptLabelsDef) {
          query {
            ...PromptLabelConfigButton_labels @arguments(promptId: $promptId)
            prompt: node(id: $promptId) {
              ... on Prompt {
                ...PromptLabels
              }
            }
          }
        }
      }
    `);
  const labels = data.promptLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search);
    });

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const newLabelIds = [...selection].filter((id) => {
      return !selectedLabelIds.includes(id as string);
    });

    if (newLabelIds.length) {
      setPromptLabel({
        variables: {
          newPromptLabelsDef: {
            promptId,
            promptLabelIds: newLabelIds as string[],
          },
          promptId,
        },
      });
    }
    setSelected(selection);
  };
  return (
    <Autocomplete>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Flex direction="row" justifyContent="space-between">
            <Heading level={4} weight="heavy">
              Assign labels to this prompt
            </Heading>
            <IconButton size="S" onPress={onNewLabelPress}>
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          </Flex>
          <DebouncedSearch
            autoFocus
            aria-label="Search labels"
            placeholder="Search labels..."
            onChange={setSearch}
          />
        </Flex>
      </View>
      <ListBox
        aria-label="labels"
        items={labels}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={onSelectionChange}
        css={css`
          height: 300px;
        `}
        renderEmptyState={() => "No labels found"}
      >
        {(item) => <PromptLabelListBoxItem key={item.id} item={item} />}
      </ListBox>
    </Autocomplete>
  );
}

type PromptLabel =
  PromptLabelConfigButton_labels$data["promptLabels"]["edges"][number]["node"];

function PromptLabelListBoxItem({ item }: { item: PromptLabel }) {
  return (
    <ListBoxItem key={item.id} id={item.id}>
      {({ isSelected }) => (
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="row" gap="size-100" alignItems="center">
            <ColorSwatch color={item.color} size="M" shape="circle" />
            {item.name}
          </Flex>
          {isSelected ? <Icon svg={<Icons.CheckmarkOutline />} /> : null}
        </Flex>
      )}
    </ListBoxItem>
  );
}
