import { Suspense, useMemo, useState } from "react";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Alert,
  Autocomplete,
  Button,
  ColorSwatch,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Input,
  LinkButton,
  Loading,
  Menu,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  Popover,
  PopoverArrow,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { NewLabelForm } from "@phoenix/components/label";
import { usePromptLabelMutations } from "@phoenix/components/prompt/usePromptLabelMutations";
import type { PromptLabelConfigButton_allLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_allLabels.graphql";
import type { PromptLabelConfigButton_promptLabels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_promptLabels.graphql";
import type { PromptLabelConfigButtonUnsetLabelsMutation } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonUnsetLabelsMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { PromptLabelConfigButtonQuery } from "./__generated__/PromptLabelConfigButtonQuery.graphql";
import type { PromptLabelConfigButtonSetLabelsMutation } from "./__generated__/PromptLabelConfigButtonSetLabelsMutation.graphql";

type PromptLabelConfigButtonProps = {
  promptId: string;
};

export function PromptLabelConfigButton(props: PromptLabelConfigButtonProps) {
  const { promptId } = props;
  return (
    <DialogTrigger>
      <Button
        variant="quiet"
        size="S"
        leadingVisual={<Icon svg={<Icons.Settings />} />}
        aria-label="Edit prompt labels"
      />
      <Popover
        placement="bottom start"
        shouldCloseOnInteractOutside={() => true}
      >
        <PopoverArrow />
        <Dialog>
          <Suspense fallback={<Loading />}>
            <PromptLabelSelectionContent promptId={promptId} />
          </Suspense>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A self-contained label selection control for a prompt, suitable for rendering
 * inside a popover (e.g. from a table row action menu). It supports applying
 * existing labels and creating a new label inline, mirroring the datasets list
 * experience ({@link DatasetLabelSelectionContent}).
 */
export function PromptLabelSelectionContent(props: { promptId: string }) {
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

  return <PromptLabelList query={query} prompt={query.prompt} />;
}

function PromptLabelList({
  query,
  prompt,
}: {
  prompt: PromptLabelConfigButton_promptLabels$key;
  query: PromptLabelConfigButton_allLabels$key;
}) {
  const [mode, setMode] = useState<"apply" | "create">("apply");
  const [error, setError] = useState<string | null>(null);
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

  const selectedLabelIds = useMemo(
    () => promptData?.labels?.map((label) => label.id) ?? [],
    [promptData?.labels]
  );
  // Derive selected state directly from Relay data - no need for separate state
  const selected = useMemo(() => new Set(selectedLabelIds), [selectedLabelIds]);

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

  const onError = (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    setError(formattedError?.[0] ?? error.message);
  };

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const newLabelIds = [...selection].filter(
      (key): key is string => typeof key === "string"
    );
    const labelIdsToAdd = newLabelIds.filter(
      (id) => !selectedLabelIds.includes(id)
    );
    const labelIdsToRemove = selectedLabelIds.filter(
      (id) => !newLabelIds.includes(id)
    );

    if (labelIdsToAdd.length) {
      setPromptLabels({
        variables: { promptId: promptData.id, promptLabelIds: labelIdsToAdd },
        onError,
      });
    }
    if (labelIdsToRemove.length) {
      unsetPromptLabels({
        variables: {
          promptId: promptData.id,
          promptLabelIds: labelIdsToRemove,
        },
        onError,
      });
    }
  };

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            mode === "create" ? (
              <Button
                variant="quiet"
                size="S"
                aria-label="Back to labels"
                leadingVisual={<Icon svg={<Icons.ChevronLeftSmall />} />}
                onPress={() => setMode("apply")}
              />
            ) : undefined
          }
          trailingContent={
            mode === "apply" ? (
              <Button
                variant="quiet"
                size="S"
                aria-label="Create new label"
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                onPress={() => setMode("create")}
              />
            ) : undefined
          }
        >
          {mode === "create" ? "Create New Label" : "Assign labels"}
        </MenuHeaderTitle>
      </MenuHeader>
      {mode === "apply" && (
        <>
          <Autocomplete filter={contains}>
            <MenuHeader>
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
              renderEmptyState={() => (
                <CompactEmptyState
                  icon={<Icon svg={<Icons.PriceTags />} />}
                  description="No labels"
                />
              )}
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
      )}
      {mode === "create" && (
        <CreateNewPromptLabel onCompleted={() => setMode("apply")} />
      )}
    </>
  );
}

function CreateNewPromptLabel({ onCompleted }: { onCompleted: () => void }) {
  const { addLabelMutation, isSubmitting, error } = usePromptLabelMutations();
  return (
    <>
      {error && (
        <Alert banner variant="danger">
          {error}
        </Alert>
      )}
      <NewLabelForm
        onSubmit={(label) => addLabelMutation(label, onCompleted)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
