import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";

/**
 * This is to keep the height of the picker and the button the same
 * Our buttons have icons with size of 1.3rem, which becomes 20.8px where as the picker text has a line height of 20px with border and margins this becomes 30px
 * so the height of the picker does not change , we just shrink the button a bit to match the height of the picker
 * This is currently the case everywhere, where a compact button with an icon will be .8px bigger than a compact button without
 */
const DATASET_PICKER_BUTTON_HEIGHT = 30;

const playgroundDatasetSelectCSS = css`
  display: flex;
  direction: row;
  align-items: center;
  & .dataset-picker-button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    height: ${DATASET_PICKER_BUTTON_HEIGHT}px;
    &[data-pressed],
    &:hover {
      // remove the bright hover border effect so that it matches the "clear" button
      // next to the dataset picker
      --button-border-color: var(--ac-global-input-field-border-color);
    }
  }
  & .dataset-clear-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
    height: ${DATASET_PICKER_BUTTON_HEIGHT}px;
  }
`;

export function PlaygroundDatasetSelect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetId = searchParams.get("datasetId");
  const splitIds = searchParams.getAll("splitId");

  return (
    <div css={playgroundDatasetSelectCSS}>
      <DatasetSelectWithSplits
        size="S"
        placeholder="Test over a dataset"
        value={
          datasetId
            ? {
                datasetId,
                splitIds,
              }
            : null
        }
        onSelectionChange={({ datasetId, splitIds }) => {
          setSearchParams((prev) => {
            if (datasetId) {
              prev.set("datasetId", datasetId);
              // Remove all existing splitId params
              prev.delete("splitId");
              // Add each split ID as a separate param
              if (splitIds.length > 0) {
                splitIds.forEach((splitId) => {
                  prev.append("splitId", splitId);
                });
              }
            } else {
              prev.delete("datasetId");
              prev.delete("splitId");
            }
            return prev;
          });
        }}
      />
      <Button
        className="dataset-clear-button"
        size="S"
        leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
        onPress={() => {
          setSearchParams((prev) => {
            prev.delete("datasetId");
            prev.delete("splitId");
            return prev;
          });
        }}
      />
    </div>
  );
}
