import { css } from "@emotion/react";
import { useCallback, useState } from "react";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";
import { DatasetFromFileForm } from "@phoenix/pages/datasets/DatasetFromFileForm";

import { AddExampleFromScratchForm } from "./AddExampleFromScratchForm";

const dialogCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
`;

const contentCSS = css`
  height: auto;
  flex: 1 1 auto;
  min-height: 0;
`;

const tabPanelCSS = css`
  flex: 1;
  min-height: 0;
`;

type AddDatasetExampleButtonProps = {
  datasetId: string;
  datasetName: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, datasetName, onAddExampleCompleted } = props;
  const [isOpen, setIsOpen] = useState(false);

  const handleCompleted = useCallback(() => {
    onAddExampleCompleted();
  }, [onAddExampleCompleted]);

  const handleFileCompleted = useCallback(() => {
    onAddExampleCompleted();
    setIsOpen(false);
  }, [onAddExampleCompleted]);

  const handleCancel = useCallback(() => setIsOpen(false), []);

  return (
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        size="M"
        aria-label="Add Dataset Example"
        variant="primary"
        onPress={() => setIsOpen(true)}
      >
        Examples
      </Button>
      <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal variant="slideover" size="fullscreen">
          <Dialog css={dialogCSS}>
            {({ close }) => (
              <>
                <DialogHeader>
                  <DialogTitle>Add Examples</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <DialogContent css={contentCSS}>
                  <Tabs>
                    <TabList>
                      <Tab id="fromFile">From file</Tab>
                      <Tab id="fromScratch">From scratch</Tab>
                    </TabList>
                    <TabPanel id="fromFile" css={tabPanelCSS}>
                      <DatasetFromFileForm
                        mode="append"
                        datasetName={datasetName}
                        onExamplesAdded={handleFileCompleted}
                        onCancel={handleCancel}
                      />
                    </TabPanel>
                    <TabPanel id="fromScratch">
                      <AddExampleFromScratchForm
                        datasetId={datasetId}
                        onExampleAdded={handleCompleted}
                        close={close}
                      />
                    </TabPanel>
                  </Tabs>
                </DialogContent>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
