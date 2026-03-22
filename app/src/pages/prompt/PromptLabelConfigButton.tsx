import { Suspense, useMemo, useState } from "react";
import { ModalOverlay } from "react-aria-components";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Autocomplete,
  Button,
  ColorSwatch,
  Dialog,
  DialogTrigger,
  Icon,
  IconButton,
  Icons,
  Input,
  LinkButton,
  Loading,
  Menu,
  MenuEmpty,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  Modal,
  Popover,
  PopoverArrow,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";
import { NewPromptLabelDialog } from "@phoenix/components/prompt/NewPromptLabelDialog";
import type { PromptLabelConfigButton_allLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_allLabels.graphql";
import type { PromptLabelConfigButton_promptLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_promptLabels.graphql";
import type { PromptLabelConfigButtonUnsetLabelsMutation } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonUnsetLabelsMutation.graphql";

import type { PromptLabelConfigButtonQuery } from "./__generated__/PromptLabelConfigButtonQuery.graphql";
import type { PromptLabelConfigButtonSetLabelsMutation } from "./__generated__/PromptLabelConfigButtonSetLabelsMutation.graphql";

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
  const { contains } = useFilter({ sensitivity: "base" });
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
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  const labels = useMemo(
    () => labelData.promptLabels.edges.map((edge) => edge.node),
    [labelData]
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
    <>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <MenuHeaderTitle
            trailingContent={
              <IconButton size="S" onPress={onNewLabelPress}>
                <Icon svg={<Icons.PlusOutline />} />
              </IconButton>
            }
          >
            Assign labels to this prompt
          </MenuHeaderTitle>
          <SearchField aria-label="Search labels" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Search labels..." />
          </SearchField>
        </MenuHeader>
        <Menu
          aria-label="labels"
          items={labels}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={onSelectionChange}
          renderEmptyState={() => <MenuEmpty>No labels found</MenuEmpty>}
        >
          {({ id, name, color }) => (
            <MenuItem
              id={id}
              textValue={name}
              leadingContent={
                <ColorSwatch
                  color={color ?? undefined}
                  size="M"
                  shape="circle"
                />
              }
            >
              {name}
            </MenuItem>
          )}
        </Menu>
      </Autocomplete>
      <MenuFooter>
        <LinkButton variant="quiet" size="S" to="/settings/prompts">
          Edit Labels
        </LinkButton>
      </MenuFooter>
    </>
  );
}
