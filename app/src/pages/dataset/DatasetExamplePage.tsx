import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import type { DatasetExamplePageQuery } from "./__generated__/DatasetExamplePageQuery.graphql";

/**
 * A page that shows the details of a dataset example.
 */
export function DatasetExamplePage() {
  const { datasetId, exampleId } = useParams();
  useLazyLoadQuery<DatasetExamplePageQuery>(
    graphql`
      query DatasetExamplePageQuery($exampleId: GlobalID!) {
        node(id: $exampleId) {
          ... on DatasetExample {
            input
            output
            metadata
          }
        }
      }
    `,
    { exampleId: exampleId as string }
  );
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/datasets/${datasetId}`)}
    >
      <Dialog size="fullscreen" title="Dataset Example">
        <main>
          <h1>hello world</h1>
        </main>
      </Dialog>
    </DialogContainer>
  );
}
