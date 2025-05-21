import { useNavigate, useParams } from "react-router";

import { ExampleDetailsDialog } from "./ExampleDetailsDialog";

/**
 * A page that shows the details of a dataset example.
 */
export function ExamplePage() {
  const { exampleId, datasetId } = useParams();
  const navigate = useNavigate();
  return (
    <ExampleDetailsDialog
      exampleId={exampleId as string}
      onDismiss={() => {
        navigate(`/datasets/${datasetId}/examples`);
      }}
    />
  );
}
