import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";

import {
  Alert,
  Button,
  Dialog,
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
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import {
  DatasetFromFileForm,
  type DatasetFormHandle,
} from "./DatasetFromFileForm";

type CreateDatasetActionMenuProps = {
  onDatasetCreated: () => void;
};

type DatasetCreationTab = "fromFile" | "fromScratch";

const triggerButtonCSS = css`
  height: calc(var(--global-button-height-m) + var(--global-dimension-size-50));
  padding: var(--global-dimension-static-size-150)
    var(--global-dimension-static-size-250);
  font-size: var(--global-dimension-static-font-size-200);
`;

const dialogCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
`;

const errorBannerCSS = css`
  margin-bottom: var(--global-dimension-size-200);
`;

export function NewDatasetActionMenu({
  onDatasetCreated,
}: CreateDatasetActionMenuProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [selectedTab, setSelectedTab] =
    useState<DatasetCreationTab>("fromFile");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileFormRef = useRef<DatasetFormHandle>(null);
  const scratchFormRef = useRef<DatasetFormHandle>(null);
  const activeFormRef =
    selectedTab === "fromFile" ? fileFormRef : scratchFormRef;

  const handleDatasetCreated = useCallback(
    (newDataset: { id: string; name: string }) => {
      notifySuccess({
        title: "Dataset created",
        message: `${newDataset.name} has been successfully created.`,
        action: {
          text: "Go to Dataset",
          onClick: () => {
            navigate(`/datasets/${newDataset.id}`);
          },
        },
      });
      setErrorMessage(null);
      setIsOpen(false);
      onDatasetCreated();
    },
    [navigate, notifySuccess, onDatasetCreated]
  );

  const handleDatasetCreateError = useCallback((error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    setErrorMessage(formattedError?.[0] ?? error.message);
  }, []);

  const handleErrorClear = useCallback(() => setErrorMessage(null), []);

  return (
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button
        variant="primary"
        size="M"
        leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
        onPress={() => setIsOpen(true)}
        css={triggerButtonCSS}
        aria-label="Create a new dataset"
      >
        New Dataset
      </Button>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setErrorMessage(null);
          }
          if (open) {
            setSelectedTab("fromFile");
          }
        }}
      >
        <Modal variant="slideover" size="L">
          <Dialog css={dialogCSS}>
            <DialogHeader>
              <DialogTitle>Create Dataset</DialogTitle>
              <DialogTitleExtra>
                <Button
                  variant="default"
                  size="S"
                  onPress={() => {
                    activeFormRef.current?.reset();
                    setIsOpen(false);
                    setErrorMessage(null);
                  }}
                  isDisabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  isDisabled={!isValid || isSubmitting}
                  onPress={() => {
                    activeFormRef.current?.submit();
                  }}
                  variant="primary"
                  size="S"
                  leadingVisual={
                    isSubmitting ? (
                      <Icon svg={<Icons.LoadingOutline />} />
                    ) : undefined
                  }
                >
                  {isSubmitting ? "Creating..." : "Create Dataset"}
                </Button>
              </DialogTitleExtra>
            </DialogHeader>
            <DialogContent>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  const nextTab = String(key);
                  if (nextTab === "fromFile" || nextTab === "fromScratch") {
                    setSelectedTab(nextTab);
                    setErrorMessage(null);
                  }
                }}
              >
                {errorMessage ? (
                  <Alert variant="danger" banner css={errorBannerCSS}>
                    {errorMessage}
                  </Alert>
                ) : null}
                <TabList>
                  <Tab id="fromFile">From file</Tab>
                  <Tab id="fromScratch">From scratch</Tab>
                </TabList>
                <TabPanel id="fromFile">
                  <DatasetFromFileForm
                    ref={fileFormRef}
                    onDatasetCreated={handleDatasetCreated}
                    onDatasetCreateError={handleDatasetCreateError}
                    onErrorClear={handleErrorClear}
                    onValidChange={setIsValid}
                    onSubmittingChange={setIsSubmitting}
                  />
                </TabPanel>
                <TabPanel id="fromScratch">
                  <CreateDatasetForm
                    ref={scratchFormRef}
                    onDatasetCreated={handleDatasetCreated}
                    onDatasetCreateError={handleDatasetCreateError}
                    onValidChange={setIsValid}
                    onSubmittingChange={setIsSubmitting}
                  />
                </TabPanel>
              </Tabs>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
