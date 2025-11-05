import { Suspense, useCallback, useMemo, useState } from "react";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  type ButtonProps,
  ColorSwatch,
  DebouncedSearch,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  LinkButton,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  PopoverArrow,
  type Selection,
  View,
} from "@phoenix/components";
import {
  useDatasetLabelMutations,
  UseDatasetLabelMutationsParams,
} from "@phoenix/components/dataset/useDatasetLabelMutations";
import { NewLabelForm } from "@phoenix/components/label";
import { useNotifyError } from "@phoenix/contexts";
import { isStringArray } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetLabelConfigButton_allLabels$key } from "./__generated__/DatasetLabelConfigButton_allLabels.graphql";
import { DatasetLabelConfigButton_datasetLabels$key } from "./__generated__/DatasetLabelConfigButton_datasetLabels.graphql";
import { DatasetLabelConfigButtonQuery } from "./__generated__/DatasetLabelConfigButtonQuery.graphql";
import { DatasetLabelConfigButtonSetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonSetLabelsMutation.graphql";

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
        size="S"
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
  const [search, setSearch] = useState("");
  // Derive selected state directly from Relay data - no need for separate state
  const selected = useMemo(() => new Set(selectedLabelIds), [selectedLabelIds]);

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

  const labels = labelData.datasetLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search.toLowerCase());
    });

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
            <Flex direction="row" gap="size-100" alignItems="center">
              {mode === "create" && (
                <Button
                  variant="quiet"
                  size="S"
                  leadingVisual={<Icon svg={<Icons.ChevronLeft />} />}
                  onPress={() => setMode("apply")}
                />
              )}
              <Heading level={4} weight="heavy">
                {mode === "create"
                  ? "Create New Label for this dataset"
                  : "Assign labels to this dataset"}
              </Heading>
            </Flex>
            {mode === "apply" && (
              <Button
                variant="quiet"
                size="S"
                leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                onPress={() => setMode("create")}
              />
            )}
          </Flex>
          {mode === "apply" && (
            <DebouncedSearch
              autoFocus
              aria-label="Search labels"
              placeholder="Search labels..."
              onChange={setSearch}
            />
          )}
        </Flex>
      </View>
      {mode === "apply" && (
        <>
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
            {(item) => <DatasetLabelListBoxItem key={item.id} item={item} />}
          </ListBox>
          <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
            <LinkButton variant="quiet" size="S" to="/settings/datasets">
              Edit Labels
            </LinkButton>
          </View>
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

function DatasetLabelListBoxItem({
  item,
}: {
  item: { id: string; name: string; color: string };
}) {
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
