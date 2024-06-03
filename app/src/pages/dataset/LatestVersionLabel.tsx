import React, { useCallback } from "react";
import copy from "copy-to-clipboard";
import { css } from "@emotion/react";

import {
  Flex,
  Label,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

export function LatestVersionLabel() {
  const version = useDatasetContext((state) => state.latestVersion);
  const notifySuccess = useNotifySuccess();

  const onClick = useCallback(() => {
    copy(version.id);
    notifySuccess({
      title: "Version ID copied to clipboard",
    });
  }, [notifySuccess, version.id]);

  return (
    <TooltipTrigger delay={0} offset={3}>
      <TriggerWrap>
        <button
          onClick={onClick}
          css={css`
            background: none;
            border: none;
            cursor: pointer;
          `}
        >
          <Label color="blue-1000" shape="badge">
            <Flex direction="row" gap="size-50">
              <div>
                <Text weight="heavy" textSize="small" color="inherit">
                  Version
                </Text>
              </div>
              <div>
                <Text textSize="small">{version.id}</Text>
              </div>
            </Flex>
          </Label>
        </button>
      </TriggerWrap>
      <Tooltip>
        <Flex direction="column" gap="size-100">
          <Text weight="heavy" textSize="small" color="inherit">
            {version.description || "No description"}
          </Text>
          <Text textSize="small" color="inherit">
            {version.createdAt}
          </Text>
          <Text textSize="small" color="info">
            Click to copy version ID
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
