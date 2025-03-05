import React from "react";

import { ActionMenu, Item } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

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
          if (action === "json") {
            window.open(`/v1/experiments/${experimentId}/json`, "_blank");
          }
        }}
      >
        <Item key="json">Download JSON</Item>
      </ActionMenu>
    </StopPropagation>
  );
}
