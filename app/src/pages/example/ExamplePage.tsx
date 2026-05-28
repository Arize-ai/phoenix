import { useNavigate, useParams } from "react-router";

import { Drawer } from "@phoenix/components";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";

import { ExampleDetailsDialog } from "./ExampleDetailsDialog";

/**
 * A page that shows the details of a dataset example.
 */
export function ExamplePage() {
  const { exampleId, datasetId } = useParams();
  const navigate = useNavigate();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "example-details",
  });

  return (
    <Drawer
      isOpen
      onClose={() => navigate(`/datasets/${datasetId}/examples`)}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <ExampleDetailsDialog exampleId={exampleId as string} />
    </Drawer>
  );
}
