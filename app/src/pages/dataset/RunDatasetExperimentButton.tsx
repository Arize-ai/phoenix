import { useState } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  ButtonProps,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "@phoenix/components";
import { ExperimentCodeModal } from "@phoenix/components/experiment";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

type RunDatasetExperimentButtonProps = Pick<ButtonProps, "variant" | "size">;

enum ExperimentAction {
  RUN_VIA_SDK = "run-via-sdk",
  RUN_IN_PLAYGROUND = "run-in-playground",
}

/**
 * A button with a popover menu for running experiments on a dataset.
 * Provides two options:
 * - Run via SDK: Opens a dialog with code examples
 * - Run in Playground: Navigates to the playground with the dataset
 */
export function RunDatasetExperimentButton(
  { variant = "default", size = "S" }: RunDatasetExperimentButtonProps = {
    variant: "default",
    size: "S",
  }
) {
  const navigate = useNavigate();
  const datasetId = useDatasetContext((state) => state.datasetId);
  const datasetName = useDatasetContext((state) => state.datasetName);
  const version = useDatasetContext((state) => state.latestVersion);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const hasExamples = version != null;

  return (
    <>
      <MenuTrigger>
        <Button
          size={size}
          variant={variant}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          Experiment
        </Button>
        <Popover placement="bottom end">
          <Menu
            disabledKeys={
              hasExamples ? [] : [ExperimentAction.RUN_IN_PLAYGROUND]
            }
            onAction={(action) => {
              switch (action) {
                case ExperimentAction.RUN_VIA_SDK:
                  setIsCodeDialogOpen(true);
                  break;
                case ExperimentAction.RUN_IN_PLAYGROUND:
                  navigate(`/playground?datasetId=${datasetId}`);
                  break;
              }
            }}
          >
            <MenuItem id={ExperimentAction.RUN_VIA_SDK}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.Code />} />
                <Text>Run via SDK</Text>
              </Flex>
            </MenuItem>
            <MenuItem id={ExperimentAction.RUN_IN_PLAYGROUND}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.PlayCircleOutline />} />
                <Text>Run in Playground</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={isCodeDialogOpen}
        onOpenChange={setIsCodeDialogOpen}
      >
        <ExperimentCodeModal
          datasetId={datasetId}
          datasetName={datasetName}
          version={version}
        />
      </DialogTrigger>
    </>
  );
}
