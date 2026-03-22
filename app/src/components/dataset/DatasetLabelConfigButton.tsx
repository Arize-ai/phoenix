import { Suspense, useCallback, useMemo, useState } from "react";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Alert,
  Autocomplete,
  Button,
  type ButtonProps,
  ColorSwatch,
  Dialog,
  DialogTrigger,
  Icon,
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
  Popover,
  PopoverArrow,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";
import type { UseDatasetLabelMutationsParams } from "@phoenix/components/dataset/useDatasetLabelMutations";
import { useDatasetLabelMutations } from "@phoenix/components/dataset/useDatasetLabelMutations";
import { NewLabelForm } from "@phoenix/components/label";
import { useNotifyError } from "@phoenix/contexts";
import { isStringArray } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DatasetLabelConfigButton_allLabels$key } from "./__generated__/DatasetLabelConfigButton_allLabels.graphql";
import type { DatasetLabelConfigButton_datasetLabels$key } from "./__generated__/DatasetLabelConfigButton_datasetLabels.graphql";
import type { DatasetLabelConfigButtonQuery } from "./__generated__/DatasetLabelConfigButtonQuery.graphql";
import type { DatasetLabelConfigButtonSetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonSetLabelsMutation.graphql";

type DatasetLabelConfigButtonProps = {
  datasetId: string;
  variant?: ButtonProps["variant"];
};

export function DatasetLabelConfigButton(props: DatasetLabelConfigButtonProps) {
  const { datasetId, variant = "default" } = props;

  return (
    <DialogTrigger>
      <Button
        variant={variant}
        size="M"
        leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
        aria-label="Configure dataset labels"
      >
        Label
      </Button>
      <Popover
        placement="bottom start"
        shouldCloseOnInteractOutside={() => true}
      >
        <PopoverArrow />
        <Dialog>
          <Suspense fallback={<Loading />}>
            <DatasetLabelSelectionContent datasetId={datasetId} />
          </Suspense>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function DatasetLabelSelectionContent(props: { datasetId: string }) {
  const { datasetId } = props;
  const query = useLazyLoadQuery<DatasetLabelConfigButtonQuery>(
    graphql`
      query DatasetLabelConfigButtonQuery($datasetId: ID!) {
        ...DatasetLabelConfigButton_allLabels
        dataset: node(id: $datasetId) {
          ... on Dataset {
            ...DatasetLabelConfigButton_datasetLabels
          }
        }
      }
    `,
    { datasetId }
  );

  return <DatasetLabelList query={query} dataset={query.dataset} {...props} />;
}

function DatasetLabelList({
  query,
  dataset,
}: {
  dataset: DatasetLabelConfigButton_datasetLabels$key;
  query: DatasetLabelConfigButton_allLabels$key;
}) {
  const [mode, setMode] = useState<"apply" | "create">("apply");
  const { contains } = useFilter({ sensitivity: "base" });
  const notifyError = useNotifyError();
  const datasetData = useFragment<DatasetLabelConfigButton_datasetLabels$key>(
    graphql`
      fragment DatasetLabelConfigButton_datasetLabels on Dataset {
        id
        labels {
          id
        }
      }
    `,
    dataset
  );
  const labelData = useFragment<DatasetLabelConfigButton_allLabels$key>(
    graphql`
      fragment DatasetLabelConfigButton_allLabels on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        datasetLabels(first: $first)
          @connection(key: "DatasetLabelConfigButtonAllLabels_datasetLabels") {
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
    () => datasetData?.labels?.map((label) => label.id) || [],
    [datasetData?.labels]
  );
  // Derive selected state directly from Relay data - no need for separate state
  const selected = useMemo(() => new Set(selectedLabelIds), [selectedLabelIds]);

  const labels = useMemo(
    () => labelData.datasetLabels.edges.map((edge) => edge.node),
    [labelData]
  );

  const [setDatasetLabels] =
    useMutation<DatasetLabelConfigButtonSetLabelsMutation>(graphql`
      mutation DatasetLabelConfigButtonSetLabelsMutation(
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

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const datasetLabelIds = [...selection];
    if (!isStringArray(datasetLabelIds)) {
      return;
    }
    setDatasetLabels({
      variables: {
        datasetId: datasetData.id,
        datasetLabelIds,
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to save label changes",
          message: formattedError?.[0] ?? error.message,
        });
      },
    });
  };

  return (
    <>
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            mode === "create" ? (
              <Button
                variant="quiet"
                size="S"
                leadingVisual={<Icon svg={<Icons.ChevronLeft />} />}
                onPress={() => setMode("apply")}
              />
            ) : undefined
          }
          trailingContent={
            mode === "apply" ? (
              <Button
                variant="quiet"
                size="S"
                leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
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
              renderEmptyState={() => <MenuEmpty>No labels found</MenuEmpty>}
            >
              {({ id, name, color }) => (
                <MenuItem
                  id={id}
                  textValue={name}
                  leadingContent={
                    <ColorSwatch color={color} size="M" shape="circle" />
                  }
                >
                  {name}
                </MenuItem>
              )}
            </Menu>
          </Autocomplete>
          <MenuFooter>
            <LinkButton variant="quiet" size="S" to="/settings/datasets">
              Edit Labels
            </LinkButton>
          </MenuFooter>
        </>
      )}
      {mode === "create" && (
        <CreateNewDatasetLabel
          onCompleted={() => setMode("apply")}
          updateConnectionIds={[
            ConnectionHandler.getConnectionID(
              "client:root",
              "DatasetLabelConfigButtonAllLabels_datasetLabels"
            ),
          ]}
          datasetId={datasetData.id}
        />
      )}
    </>
  );
}

type CreateNewDatasetLabelProps = UseDatasetLabelMutationsParams & {
  onCompleted: () => void;
};

function CreateNewDatasetLabel({
  updateConnectionIds,
  datasetId,
  onCompleted,
}: CreateNewDatasetLabelProps) {
  const { addLabelMutation, isSubmitting, error } = useDatasetLabelMutations({
    updateConnectionIds,
    datasetId,
  });

  const onSubmit = useCallback(
    (label: Parameters<typeof addLabelMutation>[0]) => {
      addLabelMutation(label, onCompleted);
    },
    [addLabelMutation, onCompleted]
  );

  return (
    <>
      {!!error && (
        <Alert banner variant="danger">
          {error}
        </Alert>
      )}
      <NewLabelForm onSubmit={onSubmit} isSubmitting={isSubmitting} />
    </>
  );
}
