import React from "react";
import { useNavigate, useParams } from "react-router";

import { ExampleDetailsDialog } from "../example/ExampleDetailsDialog";

/**
 * A page that shows the details of a dataset example.
 */
export function PlaygroundExamplePage() {
  const { exampleId, datasetId } = useParams();
  const navigate = useNavigate();
  return (
    <ExampleDetailsDialog
      exampleId={exampleId as string}
      onDismiss={() => {
        navigate(`/playground/datasets/${datasetId}`);
      }}
    />
  );
}
