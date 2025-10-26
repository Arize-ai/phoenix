import { Suspense, useMemo, useState } from "react";
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
  ModalOverlay,
  Popover,
  PopoverArrow,
  type Selection,
  View,
} from "@phoenix/components";
import { NewDatasetLabelDialog } from "@phoenix/components/dataset/NewDatasetLabelDialog";
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
        css={css`
          min-width: 400px;
          max-width: 500px;
        `}
      >
        <PopoverArrow />
        <Dialog>
          <Suspense fallback={<Loading />}>
            <DatasetLabelSelectionDialogContent datasetId={datasetId} />
          </Suspense>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function DatasetLabelSelectionDialogContent(props: { datasetId: string }) {
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
  return (
    <>
      <DatasetLabelSelectionDialogContent {...props} />
    </>
  );
}

function DatasetLabelList({
  query,
  dataset,
}: {
  dataset: DatasetLabelConfigButton_datasetLabels$key;
  query: DatasetLabelConfigButton_allLabels$key;
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
            <DialogTrigger>
              <Button
                variant="quiet"
                size="S"
                leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              />
              <ModalOverlay>
                <Modal size="S">
                  <NewDatasetLabelDialog
                    updateConnectionIds={[
                      ConnectionHandler.getConnectionID(
                        "client:root",
                        "DatasetLabelConfigButtonAllLabels_datasetLabels"
                      ),
                    ]}
                    datasetId={datasetData.id}
                  />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
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
        {(item) => <DatasetLabelListBoxItem key={item.id} item={item} />}
      </ListBox>
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
