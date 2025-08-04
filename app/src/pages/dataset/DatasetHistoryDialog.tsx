import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Dialog, Modal, ModalOverlay } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

import { DatasetHistoryDialogQuery } from "./__generated__/DatasetHistoryDialogQuery.graphql";
import { DatasetHistoryTable } from "./DatasetHistoryTable";

export type DatasetHistoryDialogProps = {
  datasetId: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function DatasetHistoryDialog(props: DatasetHistoryDialogProps) {
  const { datasetId, isOpen, onOpenChange } = props;
  const data = useLazyLoadQuery<DatasetHistoryDialogQuery>(
    graphql`
      query DatasetHistoryDialogQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            id
            ...DatasetHistoryTable_versions
          }
        }
      }
    `,
    {
      datasetId,
    }
  );
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dataset History</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
            <div
              css={css`
                height: 500px;
              `}
            >
              <DatasetHistoryTable dataset={data.dataset} />
            </div>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
