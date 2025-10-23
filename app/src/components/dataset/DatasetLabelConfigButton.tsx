import { Suspense, useMemo, useState } from "react";
import { ModalOverlay } from "react-aria-components";
import {
  ConnectionHandler,
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { css } from "@emotion/react";

import {
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
  Modal,
  Popover,
  PopoverArrow,
  type Selection,
  View,
} from "@phoenix/components";
import { NewDatasetLabelDialog } from "@phoenix/components/dataset/NewDatasetLabelDialog";
import { useNotifyError } from "@phoenix/contexts";

import { DatasetLabelConfigButton_allLabels$key } from "./__generated__/DatasetLabelConfigButton_allLabels.graphql";
import { DatasetLabelConfigButton_datasetLabels$key } from "./__generated__/DatasetLabelConfigButton_datasetLabels.graphql";
import { DatasetLabelConfigButtonCurrentLabelsQuery } from "./__generated__/DatasetLabelConfigButtonCurrentLabelsQuery.graphql";
import { DatasetLabelConfigButtonQuery } from "./__generated__/DatasetLabelConfigButtonQuery.graphql";
import { DatasetLabelConfigButtonSetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonSetLabelsMutation.graphql";

type DatasetLabelConfigButtonProps = {
  datasetId: string;
  variant?: ButtonProps["variant"];
};

export function DatasetLabelConfigButton(props: DatasetLabelConfigButtonProps) {
  const { datasetId, variant = "default" } = props;
  const [showNewLabelDialog, setShowNewLabelDialog] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);

  // Get the connection ID so new labels appear immediately
  const connections = [
    ConnectionHandler.getConnectionID(
      "client:root",
      "DatasetLabelConfigButtonAllLabels_datasetLabels"
    ),
  ];

  return (
    <>
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
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
          css={css`
            min-width: 400px;
            max-width: 500px;
          `}
        >
          <PopoverArrow />
          <Dialog>
            <View padding="size-200">
              <Flex direction="column" gap="size-200">
                <Heading level={3}>Configure Dataset Labels</Heading>
                <Suspense fallback={<Loading />}>
                  <DatasetLabelSelectionDialogContent
                    datasetId={datasetId}
                    onNewLabelPress={() => {
                      setShowNewLabelDialog(true);
                    }}
                  />
                </Suspense>
              </Flex>
            </View>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <ModalOverlay
        isOpen={showNewLabelDialog}
        onOpenChange={setShowNewLabelDialog}
      >
        <Modal size="S">
          <Suspense fallback={<Loading />}>
            <NewDatasetLabelDialogWithData
              connections={connections}
              datasetId={datasetId}
              onCompleted={() => {
                setShowNewLabelDialog(false);
              }}
            />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </>
  );
}

function NewDatasetLabelDialogWithData({
  datasetId,
  connections,
  onCompleted,
}: {
  datasetId: string;
  connections: string[];
  onCompleted: () => void;
}) {
  const data = useLazyLoadQuery<DatasetLabelConfigButtonCurrentLabelsQuery>(
    graphql`
      query DatasetLabelConfigButtonCurrentLabelsQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            labels {
              id
            }
          }
        }
      }
    `,
    { datasetId }
  );

  const currentLabelIds = data.dataset?.labels?.map((l) => l.id) || [];

  return (
    <NewDatasetLabelDialog
      connections={connections}
      datasetId={datasetId}
      currentLabelIds={currentLabelIds}
      onCompleted={onCompleted}
    />
  );
}

function DatasetLabelSelectionDialogContent(props: {
  datasetId: string;
  onNewLabelPress: () => void;
}) {
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

/**
 * Exported label selection content with integrated "Create New Label" functionality
 * Styled to match PromptLabelConfigButton
 */
export function DatasetLabelSelectionContent(props: { datasetId: string }) {
  const { datasetId } = props;
  const [showNewLabelDialog, setShowNewLabelDialog] = useState<boolean>(false);

  // Get the connection ID for this specific query so new labels appear immediately
  const connections = [
    ConnectionHandler.getConnectionID(
      "client:root",
      "DatasetLabelConfigButtonAllLabels_datasetLabels"
    ),
  ];

  return (
    <>
      <DatasetLabelSelectionDialogContent
        {...props}
        onNewLabelPress={() => setShowNewLabelDialog(true)}
      />
      <ModalOverlay
        isOpen={showNewLabelDialog}
        onOpenChange={setShowNewLabelDialog}
      >
        <Modal size="S">
          <Suspense fallback={<Loading />}>
            <NewDatasetLabelDialogWithData
              connections={connections}
              datasetId={datasetId}
              onCompleted={() => {
                // Only close the create modal, keep the popover open
                setShowNewLabelDialog(false);
              }}
            />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </>
  );
}

function DatasetLabelList({
  query,
  dataset,
  onNewLabelPress,
}: {
  dataset: DatasetLabelConfigButton_datasetLabels$key;
  query: DatasetLabelConfigButton_allLabels$key;
  onNewLabelPress: () => void;
}) {
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
        $datasetIds: [ID!]!
        $datasetLabelIds: [ID!]!
        $currentDatasetId: ID!
      ) {
        setDatasetLabels(
          input: { datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds }
        ) {
          query {
            node(id: $currentDatasetId) {
              ... on Dataset {
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

  const labels = labelData.datasetLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search.toLowerCase());
    });

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }

    // Simply set the labels to the new selection
    const newLabelIds = [...selection] as string[];

    setDatasetLabels({
      variables: {
        datasetIds: [datasetData.id],
        datasetLabelIds: newLabelIds,
        currentDatasetId: datasetData.id,
      },
      onError: () => {
        notifyError({
          title: "Failed to save label changes",
          message: "Failed to save label changes. Please try again.",
        });
      },
    });
  };

  return (
    <>
      {/* Header section matching PromptLabelConfigButton */}
      <View
        padding="size-100"
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
              Assign labels to this dataset
            </Heading>
            <Button variant="quiet" size="S" onPress={onNewLabelPress}>
              <Icon svg={<Icons.PlusOutline />} />
            </Button>
          </Flex>
          <DebouncedSearch
            autoFocus
            aria-label="Search labels"
            placeholder="Search labels..."
            onChange={setSearch}
          />
        </Flex>
      </View>

      {/* Labels list */}
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

      {/* Footer section */}
      <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
        <LinkButton variant="quiet" size="S" to="/settings/datasets">
          Edit Labels
        </LinkButton>
      </View>
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
