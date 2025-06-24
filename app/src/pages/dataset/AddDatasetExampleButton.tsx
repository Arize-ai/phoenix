import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";

import { AddDatasetExampleDialog } from "./AddDatasetExampleDialog";

type AddDatasetExampleButtonProps = {
  datasetId: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, onAddExampleCompleted } = props;

  return (
    <DialogTrigger>
      <Button
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        size="S"
        aria-label="Add Dataset Example"
      >
        Add Example
      </Button>
      <ModalOverlay>
        <Modal size="L">
          <AddDatasetExampleDialog
            datasetId={datasetId}
            onCompleted={() => {
              onAddExampleCompleted();
            }}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
