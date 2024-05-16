import React, { ReactNode, Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Heading,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DatasetsPageQuery } from "./__generated__/DatasetsPageQuery.graphql";
import { CreateDatasetForm } from "./CreateDatasetForm";
import { DatasetsTable } from "./DatasetsTable";

export function DatasetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DatasetsPageContent />
    </Suspense>
  );
}

export function DatasetsPageContent() {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<DatasetsPageQuery>(
    graphql`
      query DatasetsPageQuery {
        ...DatasetsTable_datasets
      }
    `,
    {},
    {
      fetchKey: fetchKey,
    }
  );

  // TODO(persistence): figure out how to refresh the data after a dataset is created
  const onDatasetCreated = useCallback(() => {
    setFetchKey((prev) => prev + 1);
  }, [setFetchKey]);
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>Datasets</Heading>
          <CreateDatasetButton onDatasetCreated={onDatasetCreated} />
        </Flex>
      </View>
      <DatasetsTable query={data} />
    </Flex>
  );
}

type CreateDatasetButtonProps = {
  onDatasetCreated: () => void;
};
function CreateDatasetButton({ onDatasetCreated }: CreateDatasetButtonProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onCreateDataset = () => {
    setDialog(
      <Dialog size="S" title="New Dataset">
        <CreateDatasetForm
          onDatasetCreated={(dataset) => {
            notifySuccess({
              title: "Dataset created",
              message: `${dataset.name} has been successfully created.`,
              action: {
                text: "Go to Dataset",
                onClick: () => {
                  navigate(`/datasets/${dataset.id}`);
                },
              },
            });
            setDialog(null);
            onDatasetCreated();
          }}
          onDatasetCreateError={(error) => {
            notifyError({
              title: "Dataset creation failed",
              message: error.message,
            });
          }}
        />
      </Dialog>
    );
  };
  return (
    <>
      {/* Disabled until the mutation is created */}
      <Button variant="default" onClick={onCreateDataset}>
        Create Dataset
      </Button>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
