import React from "react";

import { ActionMenu, Item } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";

interface DownloadExperimentActionMenuProps {
  experimentId: string;
}

export function DownloadExperimentActionMenu({
  experimentId,
}: DownloadExperimentActionMenuProps) {
  return (
    <div
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        buttonSize="compact"
        align="end"
        icon={<Icon svg={<Icons.DownloadOutline />} />}
        onAction={(action) => {
          if (action === "json") {
            window.open(`/v1/experiments/${experimentId}/jsonl`, "_blank");
          }
        }}
      >
        <Item key="json">Download JSON</Item>
      </ActionMenu>
    </div>
  );
}
