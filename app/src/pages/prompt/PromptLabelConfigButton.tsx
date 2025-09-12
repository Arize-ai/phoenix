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
import { PromptLabelConfigButtonSetLabelMutation } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonSetLabelMutation.graphql";

import { NewPromptLabelDialog } from "./NewPromptLabelDialog";

type PromptLabelConfigButtonProps = {
  promptId: string;
};

export function PromptLabelConfigButton(props: PromptLabelConfigButtonProps) {
  const { promptId } = props;
  const [showNewLabelDialog, setShowNewLabelDialog] = useState<boolean>(false);
  return (
    <>
      <DialogTrigger>
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
      {showNewLabelDialog ? <NewPromptLabelDialog /> : null}
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
        prompt: node(id: $promptId) {
          ... on Prompt {
            labels {
              id
            }
          }
        }
        ...PromptLabelConfigButton_labels
      }
    `,
    { promptId }
  );
  const selectedPromptIds = query.prompt.labels?.map((label) => label.id) || [];
  return (
    <PromptLabelList
      query={query}
      {...props}
      selectedLabelIds={selectedPromptIds}
    />
  );
}
function PromptLabelList({
  promptId,
  selectedLabelIds,
  query,
  onNewLabelPress,
}: {
  promptId: string;
  query: PromptLabelConfigButton_labels$key;
  onNewLabelPress: () => void;
  selectedLabelIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );
  const [data] = useRefetchableFragment(
    graphql`
      fragment PromptLabelConfigButton_labels on Query
      @refetchable(queryName: "PromptLabelConfigButtonLabelsQuery") {
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

  const [setPromptLabel] = useMutation<PromptLabelConfigButtonSetLabelMutation>(
    graphql`
      mutation PromptLabelConfigButtonSetLabelMutation(
        $newPromptLabelDef: SetPromptLabelInput!
        $promptId: ID!
      ) {
        setPromptLabel(input: $newPromptLabelDef) {
          query {
            ...PromptLabelConfigButton_labels
            prompt: node(id: $promptId) {
              ... on Prompt {
                ...PromptLabels
              }
            }
          }
        }
      }
    `
  );
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
          newPromptLabelDef: {
            promptId,
            promptLabelId: newLabelIds[0] as string,
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
