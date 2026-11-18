import { useCallback, useMemo, useState } from "react";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import type { RecordSourceSelectorProxy } from "relay-runtime";

import {
  Alert,
  EditableTagGroup,
  LinkButton,
  TagPicker,
} from "@phoenix/components";
import { labelTagItem, NewLabelForm } from "@phoenix/components/label";
import type { CreatedPromptLabel } from "@phoenix/components/prompt/usePromptLabelMutations";
import { usePromptLabelMutations } from "@phoenix/components/prompt/usePromptLabelMutations";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { PromptLabelPicker_allLabels$key } from "./__generated__/PromptLabelPicker_allLabels.graphql";
import type { PromptLabelPickerPromptQuery } from "./__generated__/PromptLabelPickerPromptQuery.graphql";
import type { PromptLabelPickerQuery } from "./__generated__/PromptLabelPickerQuery.graphql";
import type { PromptLabelPickerSetLabelsMutation } from "./__generated__/PromptLabelPickerSetLabelsMutation.graphql";
import type { PromptLabelPickerUnsetLabelsMutation } from "./__generated__/PromptLabelPickerUnsetLabelsMutation.graphql";

export type PromptLabel = CreatedPromptLabel;

/**
 * Saves changes to a prompt's labels. `setPromptLabels` adds labels and
 * `unsetPromptLabels` removes them, so a new set is sent as the difference
 * from the current one. The new set shows at once, before the server
 * answers, so quick successive edits each build on the last.
 */
export function useSavePromptLabels({
  promptId,
  currentLabels,
}: {
  promptId: string;
  currentLabels: readonly PromptLabel[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [commitSet] = useMutation<PromptLabelPickerSetLabelsMutation>(graphql`
    mutation PromptLabelPickerSetLabelsMutation(
      $promptId: ID!
      $promptLabelIds: [ID!]!
    ) {
      setPromptLabels(
        input: { promptId: $promptId, promptLabelIds: $promptLabelIds }
      ) {
        query {
          node(id: $promptId) {
            ... on Prompt {
              id
              labels {
                id
                name
                color
              }
            }
          }
        }
      }
    }
  `);
  const [commitUnset] = useMutation<PromptLabelPickerUnsetLabelsMutation>(
    graphql`
      mutation PromptLabelPickerUnsetLabelsMutation(
        $promptId: ID!
        $promptLabelIds: [ID!]!
      ) {
        unsetPromptLabels(
          input: { promptId: $promptId, promptLabelIds: $promptLabelIds }
        ) {
          query {
            node(id: $promptId) {
              ... on Prompt {
                id
                labels {
                  id
                  name
                  color
                }
              }
            }
          }
        }
      }
    `
  );
  const savePromptLabels = useCallback(
    (nextLabels: readonly PromptLabel[]) => {
      setError(null);
      const currentIds = new Set(currentLabels.map((label) => label.id));
      const nextIds = new Set(nextLabels.map((label) => label.id));
      const labelIdsToAdd = [...nextIds].filter((id) => !currentIds.has(id));
      const labelIdsToRemove = [...currentIds].filter((id) => !nextIds.has(id));
      const optimisticUpdater = (store: RecordSourceSelectorProxy) => {
        const prompt = store.get(promptId);
        const labelRecords = nextLabels
          .map((label) => store.get(label.id))
          .filter((record) => record != null);
        prompt?.setLinkedRecords(labelRecords, "labels");
      };
      const onError = (mutationError: Error) => {
        const formattedError =
          getErrorMessagesFromRelayMutationError(mutationError);
        setError(formattedError?.[0] ?? mutationError.message);
      };
      if (labelIdsToAdd.length > 0) {
        commitSet({
          variables: { promptId, promptLabelIds: labelIdsToAdd },
          optimisticUpdater,
          onError,
        });
      }
      if (labelIdsToRemove.length > 0) {
        commitUnset({
          variables: { promptId, promptLabelIds: labelIdsToRemove },
          optimisticUpdater,
          onError,
        });
      }
    },
    [commitSet, commitUnset, currentLabels, promptId]
  );
  return { savePromptLabels, error };
}

/**
 * Every prompt label, checked where it is in `selectedLabels`, with a way to
 * create a new one. A label created here joins the selection. Loads the
 * labels itself, so render it where it may suspend.
 */
export function PromptLabelPicker({
  selectedLabels,
  onChange,
  error,
}: {
  selectedLabels: readonly PromptLabel[];
  onChange: (labels: PromptLabel[]) => void;
  error?: string | null;
}) {
  const query = useLazyLoadQuery<PromptLabelPickerQuery>(
    graphql`
      query PromptLabelPickerQuery {
        ...PromptLabelPicker_allLabels
      }
    `,
    {}
  );
  const labelData = useFragment<PromptLabelPicker_allLabels$key>(
    graphql`
      fragment PromptLabelPicker_allLabels on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        promptLabels(first: $first)
          @connection(key: "PromptLabelPicker_promptLabels") {
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
  const labels = useMemo(
    () => labelData.promptLabels.edges.map((edge) => edge.node),
    [labelData]
  );
  const options = useMemo(() => labels.map(labelTagItem), [labels]);
  const selectedKeys = useMemo(
    () => selectedLabels.map((label) => label.id),
    [selectedLabels]
  );

  return (
    <TagPicker
      options={options}
      selectedKeys={selectedKeys}
      onSelectionChange={(ids) =>
        onChange(labels.filter((label) => ids.has(label.id)))
      }
      error={error}
      footer={
        <LinkButton variant="quiet" size="S" to="/settings/prompts">
          Edit Labels
        </LinkButton>
      }
      renderCreateForm={({ onDone }) => (
        <CreatePromptLabel
          onCreated={(createdLabel) => {
            if (createdLabel) {
              onChange([...selectedLabels, createdLabel]);
            }
            onDone();
          }}
        />
      )}
    />
  );
}

function CreatePromptLabel({
  onCreated,
}: {
  onCreated: (label: PromptLabel | undefined) => void;
}) {
  const { addLabelMutation, isSubmitting, error } = usePromptLabelMutations();
  return (
    <>
      {error ? (
        <Alert banner variant="danger">
          {error}
        </Alert>
      ) : null}
      <NewLabelForm
        onSubmit={(label) => addLabelMutation(label, onCreated)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}

/**
 * A prompt's labels, edited in place: each change saves at once. For a
 * surface that already has the prompt's labels, such as the prompt page
 * header.
 */
export function PromptLabelsEditor({
  promptId,
  labels,
}: {
  promptId: string;
  labels: readonly PromptLabel[];
}) {
  const { savePromptLabels, error } = useSavePromptLabels({
    promptId,
    currentLabels: labels,
  });
  return (
    <>
      <EditableTagGroup
        aria-label="Prompt labels"
        items={labels.map(labelTagItem)}
        onRemove={(ids) =>
          savePromptLabels(labels.filter((label) => !ids.has(label.id)))
        }
        picker={
          <PromptLabelPicker
            selectedLabels={labels}
            onChange={savePromptLabels}
          />
        }
      />
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </>
  );
}

/**
 * The label picker for one prompt, saving each change at once. It loads the
 * prompt's labels itself, for a surface that only has its id, such as a
 * table row's action menu.
 */
export function PromptLabelSelectionContent({
  promptId,
}: {
  promptId: string;
}) {
  const data = useLazyLoadQuery<PromptLabelPickerPromptQuery>(
    graphql`
      query PromptLabelPickerPromptQuery($promptId: ID!) {
        prompt: node(id: $promptId) {
          ... on Prompt {
            labels {
              id
              name
              color
            }
          }
        }
      }
    `,
    { promptId }
  );
  const labels = data.prompt.labels ?? [];
  const { savePromptLabels, error } = useSavePromptLabels({
    promptId,
    currentLabels: labels,
  });
  return (
    <PromptLabelPicker
      selectedLabels={labels}
      onChange={savePromptLabels}
      error={error}
    />
  );
}
