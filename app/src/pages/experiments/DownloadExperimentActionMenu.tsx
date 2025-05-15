import { ActionMenu, Item } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { prependBasename } from "@phoenix/utils/routingUtils";
interface DownloadExperimentActionMenuProps {
  experimentId: string;
}

export function DownloadExperimentActionMenu({
  experimentId,
}: DownloadExperimentActionMenuProps) {
  return (
    <StopPropagation>
      <ActionMenu
        buttonSize="compact"
        align="end"
        icon={<Icon svg={<Icons.DownloadOutline />} />}
        onAction={(action) => {
          if (action === "csv") {
            window.open(
              prependBasename(`/v1/experiments/${experimentId}/csv`),
              "_blank"
            );
          }
          if (action === "json") {
            window.open(
              prependBasename(`/v1/experiments/${experimentId}/json`),
              "_blank"
            );
          }
        }}
      >
        <Item key="csv">Download CSV</Item>
        <Item key="json">Download JSON</Item>
      </ActionMenu>
    </StopPropagation>
  );
}
