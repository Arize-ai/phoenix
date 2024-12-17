import React from "react";
import { useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@arizeai/components";

import { DatasetPicker } from "@phoenix/components/dataset";

/**
 * This is to keep the height of the picker and the button the same
 * Our buttons have icons with size of 1.3rem, which becomes 20.8px where as the picker text has a line height of 20px with border and margins this becomes 30px
 * so the height of the picker does not change , we just shrink the button a bit to match the height of the picker
 * This is currently the case everywhere, where a compact button with an icon will be .8px bigger than a compact button without
 */
const DATASET_PICKER_BUTTON_HEIGHT = 30;

const playgroundDatasetPickerCSS = css`
  display: flex;
  direction: row;
  align-items: center;
  .ac-dropdown > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    height: ${DATASET_PICKER_BUTTON_HEIGHT}px;
  }
  .ac-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
    height: ${DATASET_PICKER_BUTTON_HEIGHT}px;
  }
`;

export function PlaygroundDatasetPicker() {
  const navigate = useNavigate();
  const { datasetId } = useParams<{ datasetId: string }>();
  const selectedDatasetId = datasetId ?? "";

  return (
    <div css={playgroundDatasetPickerCSS}>
      <DatasetPicker
        size={"compact"}
        placeholder="Test over a dataset"
        selectedKey={selectedDatasetId}
        onSelectionChange={(datasetId) => {
          if (selectedDatasetId !== null && datasetId === selectedDatasetId) {
            navigate("/playground");
            return;
          }
          navigate(`/playground/datasets/${datasetId}`);
        }}
      />
      <Button
        size="compact"
        variant={"default"}
        icon={<Icon svg={<Icons.CloseOutline />} />}
        onClick={() => {
          navigate("/playground");
        }}
      />
    </div>
  );
}
