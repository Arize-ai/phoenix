import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import { prependBasename } from "@phoenix/utils/routingUtils";

export function DatasetDownloadMenu({ datasetId }: { datasetId: string }) {
  return (
    <MenuTrigger>
      <Button
        size="M"
        leadingVisual={<Icon svg={<Icons.DownloadOutline />} />}
      />
      <Popover>
        <Menu
          aria-label="Dataset download"
          onAction={(action) => {
            switch (action) {
              case "csv":
                window.open(
                  prependBasename(`/v1/datasets/${datasetId}/csv`),
                  "_blank"
                );
                break;
              case "openai-ft":
                window.open(
                  prependBasename(`/v1/datasets/${datasetId}/jsonl/openai_ft`),
                  "_blank"
                );
                break;
              case "openai-evals":
                window.open(
                  prependBasename(
                    `/v1/datasets/${datasetId}/jsonl/openai_evals`
                  ),
                  "_blank"
                );
                break;
            }
          }}
        >
          <MenuItem id="csv">Download CSV</MenuItem>
          <MenuItem id="openai-ft">Download OpenAI Fine-Tuning JSONL</MenuItem>
          <MenuItem id="openai-evals">Download OpenAI Evals JSONL</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
