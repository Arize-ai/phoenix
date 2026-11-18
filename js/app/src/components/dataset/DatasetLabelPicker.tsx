import { useCallback, useMemo, useState } from "react";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Alert,
  EditableTagGroup,
  LinkButton,
  TagPicker,
} from "@phoenix/components";
import type { CreatedDatasetLabel } from "@phoenix/components/dataset/useDatasetLabelMutations";
import { useDatasetLabelMutations } from "@phoenix/components/dataset/useDatasetLabelMutations";
import { labelTagItem, NewLabelForm } from "@phoenix/components/label";
import { useAgentDataChangeFetchKey } from "@phoenix/hooks";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DatasetLabelPicker_allLabels$key } from "./__generated__/DatasetLabelPicker_allLabels.graphql";
import type { DatasetLabelPickerDatasetQuery } from "./__generated__/DatasetLabelPickerDatasetQuery.graphql";
import type { DatasetLabelPickerQuery } from "./__generated__/DatasetLabelPickerQuery.graphql";
import type { DatasetLabelPickerSetLabelsMutation } from "./__generated__/DatasetLabelPickerSetLabelsMutation.graphql";

export type DatasetLabel = CreatedDatasetLabel;

const REFRESH_ON = ["datasetLabels"] as const;

const ALL_LABELS_CONNECTION_KEY = "DatasetLabelPicker_datasetLabels";

/**
 * Saves a dataset's whole label set. `setDatasetLabels` replaces the set, so
 * every change sends all of the labels that should remain. The new set shows
 * at once, before the server answers, so quick successive edits each build on
 * the last.
 */
export function useSetDatasetLabels() {
  const [error, setError] = useState<string | null>(null);
  const [commit] = useMutation<DatasetLabelPickerSetLabelsMutation>(graphql`
    mutation DatasetLabelPickerSetLabelsMutation(
      $datasetId: ID!
      $datasetLabelIds: [ID!]!
    ) {
      setDatasetLabels(
        input: { datasetId: $datasetId, datasetLabelIds: $datasetLabelIds }
      ) {
        dataset {
          id
          labels {
            id
            name
            color
          }
        }
      }
    }
  `);
  const setDatasetLabels = useCallback(
    ({
      datasetId,
      labels,
      onSaved,
      onFailed,
    }: {
      datasetId: string;
      labels: readonly DatasetLabel[];
      /**
       * Called once the server has saved the set.
       */
      onSaved?: () => void;
      /**
       * Called with the reason when the server did not save the set.
       */
      onFailed?: (message: string) => void;
    }) => {
      setError(null);
      const fail = (message: string) => {
        setError(message);
        onFailed?.(message);
      };
      commit({
        variables: {
          datasetId,
          datasetLabelIds: labels.map((label) => label.id),
        },
        optimisticResponse: {
          setDatasetLabels: {
            dataset: { id: datasetId, labels: [...labels] },
          },
        },
        onCompleted: (_response, payloadErrors) => {
          if (payloadErrors && payloadErrors.length > 0) {
            fail(payloadErrors[0].message);
            return;
          }
          onSaved?.();
        },
        onError: (mutationError) => {
          const formattedError =
            getErrorMessagesFromRelayMutationError(mutationError);
          fail(formattedError?.[0] ?? mutationError.message);
        },
      });
    },
    [commit]
  );
  return { setDatasetLabels, error };
}

/**
 * Every dataset label, checked where it is in `selectedLabels`, with a way to
 * create a new one. A label created here joins the selection. Loads the
 * labels itself, so render it where it may suspend.
 */
export function DatasetLabelPicker({
  selectedLabels,
  onChange,
  error,
}: {
  selectedLabels: readonly DatasetLabel[];
  onChange: (labels: DatasetLabel[]) => void;
  error?: string | null;
}) {
  const fetchKey = useAgentDataChangeFetchKey(REFRESH_ON);
  const query = useLazyLoadQuery<DatasetLabelPickerQuery>(
    graphql`
      query DatasetLabelPickerQuery {
        ...DatasetLabelPicker_allLabels
      }
    `,
    {},
    {
      fetchKey,
      fetchPolicy: fetchKey === 0 ? "store-or-network" : "store-and-network",
    }
  );
  const labelData = useFragment<DatasetLabelPicker_allLabels$key>(
    graphql`
      fragment DatasetLabelPicker_allLabels on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        datasetLabels(first: $first)
          @connection(key: "DatasetLabelPicker_datasetLabels") {
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
    () => labelData.datasetLabels.edges.map((edge) => edge.node),
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
        <LinkButton variant="quiet" size="S" to="/settings/datasets">
          Edit Labels
        </LinkButton>
      }
      renderCreateForm={({ onDone }) => (
        <CreateDatasetLabel
          onCreated={(createdLabel) => {
            onChange([...selectedLabels, createdLabel]);
            onDone();
          }}
        />
      )}
    />
  );
}

function CreateDatasetLabel({
  onCreated,
}: {
  onCreated: (label: DatasetLabel) => void;
}) {
  const updateConnectionIds = useMemo(
    () => [
      ConnectionHandler.getConnectionID(
        "client:root",
        ALL_LABELS_CONNECTION_KEY
      ),
    ],
    []
  );
  const { addLabelMutation, isSubmitting, error } = useDatasetLabelMutations({
    updateConnectionIds,
  });
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
 * A dataset's labels, edited in place: each change saves at once. For a
 * surface that already has the dataset's labels, such as the dataset page
 * header.
 */
export function DatasetLabelsEditor({
  datasetId,
  labels,
}: {
  datasetId: string;
  labels: readonly DatasetLabel[];
}) {
  const { setDatasetLabels, error } = useSetDatasetLabels();
  const saveLabels = (nextLabels: readonly DatasetLabel[]) =>
    setDatasetLabels({ datasetId, labels: nextLabels });
  return (
    <>
      <EditableTagGroup
        aria-label="Dataset labels"
        items={labels.map(labelTagItem)}
        onRemove={(ids) =>
          saveLabels(labels.filter((label) => !ids.has(label.id)))
        }
        picker={
          <DatasetLabelPicker selectedLabels={labels} onChange={saveLabels} />
        }
      />
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </>
  );
}

/**
 * The label picker for one dataset, saving each change at once. It loads the
 * dataset's labels itself, for a surface that only has its id, such as a
 * table row's action menu.
 */
export function DatasetLabelSelectionContent({
  datasetId,
}: {
  datasetId: string;
}) {
  const fetchKey = useAgentDataChangeFetchKey(REFRESH_ON);
  const data = useLazyLoadQuery<DatasetLabelPickerDatasetQuery>(
    graphql`
      query DatasetLabelPickerDatasetQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            labels {
              id
              name
              color
            }
          }
        }
      }
    `,
    { datasetId },
    {
      fetchKey,
      fetchPolicy: fetchKey === 0 ? "store-or-network" : "store-and-network",
    }
  );
  const { setDatasetLabels, error } = useSetDatasetLabels();
  return (
    <DatasetLabelPicker
      selectedLabels={data.dataset.labels ?? []}
      onChange={(labels) => setDatasetLabels({ datasetId, labels })}
      error={error}
    />
  );
}

/**
 * A dataset's labels as a form field: changes stay in the form until it is
 * submitted.
 */
export function DatasetLabelsField({
  value,
  onChange,
}: {
  value: readonly DatasetLabel[];
  onChange: (labels: DatasetLabel[]) => void;
}) {
  return (
    <EditableTagGroup
      aria-label="Dataset labels"
      items={value.map(labelTagItem)}
      onRemove={(ids) => onChange(value.filter((label) => !ids.has(label.id)))}
      picker={<DatasetLabelPicker selectedLabels={value} onChange={onChange} />}
    />
  );
}
