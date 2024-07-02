import React, { ReactNode, useCallback, useState } from "react";

import { Button, DialogContainer, Icon, Icons } from "@arizeai/components";

import { AddDatasetExampleDialog } from "./AddDatasetExampleDialog";

type AddDatasetExampleButtonProps = {
  datasetId: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, onAddExampleCompleted } = props;

  const [dialog, setDialog] = useState<ReactNode>(null);
  const onAddExample = useCallback(() => {
    setDialog(
      <AddDatasetExampleDialog
        datasetId={datasetId}
        onCompleted={() => {
          onAddExampleCompleted();
          setDialog(null);
        }}
      />
    );
  }, [datasetId, onAddExampleCompleted]);
  return (
    <>
      <Button
        icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        size="compact"
        variant="default"
        onClick={onAddExample}
      >
        Add Example
      </Button>
      <DialogContainer
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
