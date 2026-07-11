import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components";
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
      <MenuTrigger>
        <Button size="S" leadingVisual={<Icon svg={<Icons.Download />} />} />
        <MenuContainer size="xs" minHeight={0} shouldFlip>
          <Menu
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
            <MenuItem id="csv">Download CSV</MenuItem>
            <MenuItem id="json">Download JSON</MenuItem>
          </Menu>
        </MenuContainer>
      </MenuTrigger>
    </StopPropagation>
  );
}
