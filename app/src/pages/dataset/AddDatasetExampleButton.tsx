import { useState } from "react";

import { Button, Icon, Icons } from "@phoenix/components";

import { AddDatasetExampleDialog } from "./AddDatasetExampleDialog";

type AddDatasetExampleButtonProps = {
  datasetId: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, onAddExampleCompleted } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        size="S"
        onPress={() => setIsOpen(true)}
        aria-label="Add Dataset Example"
      >
        Add Example
      </Button>
      <AddDatasetExampleDialog
        datasetId={datasetId}
        onCompleted={() => {
          onAddExampleCompleted();
          setIsOpen(false);
        }}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
