import { Suspense, useState } from "react";
import { ModalOverlay } from "react-aria-components";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
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
  LinkButton,
  ListBox,
  ListBoxItem,
  Loading,
  Modal,
  Popover,
  PopoverArrow,
  type Selection,
  View,
} from "@phoenix/components";
import { NewPromptLabelDialog } from "@phoenix/components/prompt/NewPromptLabelDialog";
import {
  PromptLabelConfigButton_allLabels$data,
  PromptLabelConfigButton_allLabels$key,
} from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_allLabels.graphql";
import { PromptLabelConfigButton_promptLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_promptLabels.graphql";
import { PromptLabelConfigButtonUnsetLabelsMutation } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonUnsetLabelsMutation.graphql";

import { PromptLabelConfigButtonQuery } from "./__generated__/PromptLabelConfigButtonQuery.graphql";
import { PromptLabelConfigButtonSetLabelsMutation } from "./__generated__/PromptLabelConfigButtonSetLabelsMutation.graphql";

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
          leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
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
        <ModalOverlay
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowNewLabelDialog(false);
            }
          }}
        >
          <Modal size="S">
            <NewPromptLabelDialog
              onCompleted={() => setShowNewLabelDialog(false)}
            />
          </Modal>
        </ModalOverlay>
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
        ...PromptLabelConfigButton_allLabels
        prompt: node(id: $promptId) {
          ... on Prompt {
            ...PromptLabelConfigButton_promptLabels
          }
        }
      }
    `,
    { promptId }
  );

  return <PromptLabelList query={query} prompt={query.prompt} {...props} />;
}
function PromptLabelList({
  query,
  prompt,
  onNewLabelPress,
}: {
  prompt: PromptLabelConfigButton_promptLabels$key;
  query: PromptLabelConfigButton_allLabels$key;
  onNewLabelPress: () => void;
}) {
  const promptData = useFragment<PromptLabelConfigButton_promptLabels$key>(
    graphql`
      fragment PromptLabelConfigButton_promptLabels on Prompt {
        id
        labels {
          id
        }
      }
    `,
    prompt
  );
  const labelData = useFragment<PromptLabelConfigButton_allLabels$key>(
    graphql`
      fragment PromptLabelConfigButton_allLabels on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        promptLabels(first: $first)
          @connection(key: "PromptLabelConfigButtonAllLabels_promptLabels") {
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

  const selectedLabelIds = promptData?.labels?.map((label) => label.id) || [];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  const [setPromptLabels] =
    useMutation<PromptLabelConfigButtonSetLabelsMutation>(graphql`
      mutation PromptLabelConfigButtonSetLabelsMutation(
        $promptId: ID!
        $promptLabelIds: [ID!]!
      ) {
        setPromptLabels(
          input: { promptId: $promptId, promptLabelIds: $promptLabelIds }
        ) {
          query {
            node(id: $promptId) {
              ... on Prompt {
                ...PromptLabelConfigButton_promptLabels
              }
            }
          }
        }
      }
    `);
  const [unsetPromptLabels] =
    useMutation<PromptLabelConfigButtonUnsetLabelsMutation>(graphql`
      mutation PromptLabelConfigButtonUnsetLabelsMutation(
        $promptId: ID!
        $promptLabelIds: [ID!]!
      ) {
        unsetPromptLabels(
          input: { promptId: $promptId, promptLabelIds: $promptLabelIds }
        ) {
          query {
            node(id: $promptId) {
              ... on Prompt {
                ...PromptLabelConfigButton_promptLabels
              }
            }
          }
        }
      }
    `);
  const labels = labelData.promptLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search.toLowerCase());
    });

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const newLabelIds = [...selection] as string[];
    const labelIdsToAdd: string[] = newLabelIds.filter(
      (id) => !selectedLabelIds.includes(id)
    );
    const labelIdsToRemove: string[] = selectedLabelIds.filter(
      (id) => !newLabelIds.includes(id)
    );

    if (labelIdsToAdd.length) {
      setPromptLabels({
        variables: {
          promptId: promptData.id,
          promptLabelIds: labelIdsToAdd,
        },
      });
    }
    if (labelIdsToRemove.length) {
      unsetPromptLabels({
        variables: {
          promptId: promptData.id,
          promptLabelIds: labelIdsToRemove,
        },
      });
    }
    setSelected(selection);
  };
  return (
    <Autocomplete>
      <View
        padding="size-100"
        paddingTop="size-50"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
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
      <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
        <LinkButton variant="quiet" size="S" to="/settings/prompts">
          Edit Labels
        </LinkButton>
      </View>
    </Autocomplete>
  );
}

type PromptLabel =
  PromptLabelConfigButton_allLabels$data["promptLabels"]["edges"][number]["node"];

function PromptLabelListBoxItem({ item }: { item: PromptLabel }) {
  return (
    <ListBoxItem key={item.id} id={item.id}>
      {({ isSelected }) => (
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="row" gap="size-100" alignItems="center">
            <ColorSwatch
              color={item.color ?? undefined}
              size="M"
              shape="circle"
            />
            {item.name}
          </Flex>
          {isSelected ? <Icon svg={<Icons.CheckmarkOutline />} /> : null}
        </Flex>
      )}
    </ListBoxItem>
  );
}
