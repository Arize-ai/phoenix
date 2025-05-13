import { useSearchParams } from "react-router";

import { ExampleDetailsDialog } from "../example/ExampleDetailsDialog";

/**
 * A page that shows the details of a dataset example.
 */
export function PlaygroundExamplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const exampleId = searchParams.get("exampleId");
  const datasetId = searchParams.get("datasetId");
  if (!exampleId || !datasetId) {
    return null;
  }
  return (
    <ExampleDetailsDialog
      exampleId={exampleId as string}
      onDismiss={() => {
        setSearchParams((prev) => {
          prev.delete("exampleId");
          return prev;
        });
      }}
    />
  );
}
