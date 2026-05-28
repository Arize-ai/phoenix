import { useSearchParams } from "react-router";

import { Drawer } from "@phoenix/components";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";

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
    <PlaygroundExampleDrawer
      exampleId={exampleId}
      onClose={() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("exampleId");
          return next;
        });
      }}
    />
  );
}

function PlaygroundExampleDrawer({
  exampleId,
  onClose,
}: {
  exampleId: string;
  onClose: () => void;
}) {
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "playground-example-details",
  });

  return (
    <Drawer
      isOpen
      onClose={onClose}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <ExampleDetailsDialog exampleId={exampleId} />
    </Drawer>
  );
}
