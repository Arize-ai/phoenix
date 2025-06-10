import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Dialog } from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";

import { DatasetHistoryDialogQuery } from "./__generated__/DatasetHistoryDialogQuery.graphql";
import { DatasetHistoryTable } from "./DatasetHistoryTable";

export function DatasetHistoryDialog(props: { datasetId: string }) {
  const { datasetId } = props;
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
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dataset History</DialogTitle>
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
  );
}
