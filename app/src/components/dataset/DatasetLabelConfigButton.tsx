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
  Button,
  ColorSwatch,
  DebouncedSearch,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  LinkButton,
  ListBox,
  ListBoxItem,
  Loading,
  Modal,
  type Selection,
  View,
} from "@phoenix/components";
import { NewDatasetLabelDialog } from "@phoenix/components/dataset/NewDatasetLabelDialog";

import { DatasetLabelConfigButton_allLabels$key } from "./__generated__/DatasetLabelConfigButton_allLabels.graphql";
import { DatasetLabelConfigButton_datasetLabels$key } from "./__generated__/DatasetLabelConfigButton_datasetLabels.graphql";
import { DatasetLabelConfigButtonQuery } from "./__generated__/DatasetLabelConfigButtonQuery.graphql";
import { DatasetLabelConfigButtonSetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonSetLabelsMutation.graphql";
import { DatasetLabelConfigButtonUnsetLabelsMutation } from "./__generated__/DatasetLabelConfigButtonUnsetLabelsMutation.graphql";

type DatasetLabelConfigButtonProps = {
  datasetId: string;
};

export function DatasetLabelConfigButton(props: DatasetLabelConfigButtonProps) {
  const { datasetId } = props;
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
          leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
          aria-label="Configure dataset labels"
        >
          Labels
        </Button>
        <ModalOverlay>
          <Modal size="S">
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Dataset Labels</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton />
                  </DialogTitleExtra>
                </DialogHeader>
                <DialogContent>
                  <Suspense fallback={<Loading />}>
                    <DatasetLabelSelectionDialogContent
                      datasetId={datasetId}
                      onNewLabelPress={() => {
                        setShowNewLabelDialog(true);
                      }}
                    />
                  </Suspense>
                </DialogContent>
              </DialogContent>
            </Dialog>
          </Modal>
        </ModalOverlay>
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
            <NewDatasetLabelDialog
              onCompleted={() => setShowNewLabelDialog(false)}
            />
          </Modal>
        </ModalOverlay>
      ) : null}
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

function DatasetLabelList({
  query,
  dataset,
  onNewLabelPress,
}: {
  dataset: DatasetLabelConfigButton_datasetLabels$key;
  query: DatasetLabelConfigButton_allLabels$key;
  onNewLabelPress: () => void;
}) {
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

  const selectedLabelIds = datasetData?.labels?.map((label) => label.id) || [];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  const [setDatasetLabels] =
    useMutation<DatasetLabelConfigButtonSetLabelsMutation>(graphql`
      mutation DatasetLabelConfigButtonSetLabelsMutation(
        $datasetIds: [ID!]!
        $datasetLabelIds: [ID!]!
      ) {
        setDatasetLabels(
          input: { datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds }
        ) {
          query {
            __typename
          }
        }
      }
    `);

  const [unsetDatasetLabels] =
    useMutation<DatasetLabelConfigButtonUnsetLabelsMutation>(graphql`
      mutation DatasetLabelConfigButtonUnsetLabelsMutation(
        $datasetIds: [ID!]!
        $datasetLabelIds: [ID!]!
      ) {
        unsetDatasetLabels(
          input: { datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds }
        ) {
          query {
            __typename
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
    const newLabelIds = [...selection] as string[];
    const labelIdsToAdd: string[] = newLabelIds.filter(
      (id) => !selectedLabelIds.includes(id)
    );
    const labelIdsToRemove: string[] = selectedLabelIds.filter(
      (id) => !newLabelIds.includes(id)
    );

    if (labelIdsToAdd.length) {
      setDatasetLabels({
        variables: {
          datasetIds: [datasetData.id],
          datasetLabelIds: labelIdsToAdd,
        },
      });
    }
    if (labelIdsToRemove.length) {
      unsetDatasetLabels({
        variables: {
          datasetIds: [datasetData.id],
          datasetLabelIds: labelIdsToRemove,
        },
      });
    }
    setSelected(selection);
  };

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <DebouncedSearch
          autoFocus
          aria-label="Search labels"
          placeholder="Search labels..."
          onChange={setSearch}
        />
        <ListBox
          aria-label="labels"
          items={labels}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={onSelectionChange}
          css={css`
            height: 300px;
            width: 100%;
          `}
          renderEmptyState={() => "No labels found"}
        >
          {(item) => <DatasetLabelListBoxItem key={item.id} item={item} />}
        </ListBox>
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Button variant="quiet" size="S" onPress={onNewLabelPress}>
            Create New Label
          </Button>
          <LinkButton variant="quiet" size="S" to="/settings/datasets">
            Manage Labels
          </LinkButton>
        </Flex>
      </Flex>
    </View>
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
