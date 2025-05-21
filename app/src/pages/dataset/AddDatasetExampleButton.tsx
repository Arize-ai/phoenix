import { ReactNode, useCallback, useState } from "react";

import { DialogContainer } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";

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
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        size="S"
        onPress={onAddExample}
        aria-label="Add Dataset Example"
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
