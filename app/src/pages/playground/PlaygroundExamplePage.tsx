import { Suspense } from "react";
import { DialogTrigger } from "react-aria-components";
import { useSearchParams } from "react-router";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";

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
    <DialogTrigger
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSearchParams((prev) => {
            prev.delete("exampleId");
            return prev;
          });
        }
      }}
    >
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Suspense fallback={<Loading />}>
            <ExampleDetailsDialog exampleId={exampleId as string} />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
