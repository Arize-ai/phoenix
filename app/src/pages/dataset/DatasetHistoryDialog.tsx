import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Dialog } from "@arizeai/components";

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
    <Dialog size="L" title="Dataset History">
      <div
        css={css`
          height: 500px;
        `}
      >
        <DatasetHistoryTable dataset={data.dataset} />
      </div>
    </Dialog>
  );
}
