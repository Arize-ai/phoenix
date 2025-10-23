import { Suspense, useEffect, useMemo, useState } from "react";
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
import { DatasetLabelConfigButtonQuery } from "./__generated__/DatasetLabelConfigButtonQuery.graphql";
import { DatasetLabelConfigButtonSetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonSetLabelsMutation.graphql";
import { DatasetLabelConfigButtonUnsetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonUnsetLabelsMutation.graphql";

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
          <NewDatasetLabelDialog
            connections={connections}
            datasetId={datasetId}
            onCompleted={() => {
              // Only close the create modal, keep the labels popover open
              setShowNewLabelDialog(false);
            }}
          />
        </Modal>
      </ModalOverlay>
    </>
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
          <NewDatasetLabelDialog
            connections={connections}
            datasetId={datasetId}
            onCompleted={() => {
              // Only close the create modal, keep the popover open
              setShowNewLabelDialog(false);
            }}
          />
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
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  // Sync local selection state when dataset labels change (e.g., from auto-apply)
  useEffect(() => {
    setSelected(new Set(selectedLabelIds));
  }, [selectedLabelIds]);

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

  const [unsetDatasetLabels] =
    useMutation<DatasetLabelConfigButtonUnsetLabelsMutation>(graphql`
      mutation DatasetLabelConfigButtonUnsetLabelsMutation(
        $datasetIds: [ID!]!
        $datasetLabelIds: [ID!]!
        $currentDatasetId: ID!
      ) {
        unsetDatasetLabels(
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
    setSelected(selection);

    // Auto-apply changes immediately
    const newLabelIds = [...selection] as string[];
    const labelIdsToAdd: string[] = newLabelIds.filter(
      (id) => !selectedLabelIds.includes(id)
    );
    const labelIdsToRemove: string[] = selectedLabelIds.filter(
      (id) => !newLabelIds.includes(id)
    );

    const promises = [];

    if (labelIdsToAdd.length) {
      promises.push(
        setDatasetLabels({
          variables: {
            datasetIds: [datasetData.id],
            datasetLabelIds: labelIdsToAdd,
            currentDatasetId: datasetData.id,
          },
        })
      );
    }
    if (labelIdsToRemove.length) {
      promises.push(
        unsetDatasetLabels({
          variables: {
            datasetIds: [datasetData.id],
            datasetLabelIds: labelIdsToRemove,
            currentDatasetId: datasetData.id,
          },
        })
      );
    }

    // Handle errors but don't close on success (let user continue selecting)
    if (promises.length > 0) {
      Promise.all(promises).catch(() => {
        notifyError({
          title: "Failed to save label changes",
          message: "Failed to save label changes. Please try again.",
        });
      });
    }
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
