import React, { startTransition } from "react";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@arizeai/components";

import { DatasetPicker } from "@phoenix/components/dataset";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

const playgroundDatasetPickerCSS = css`
  display: flex;
  direction: row;
  .ac-dropdown > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .ac-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
  }
`;

export function PlaygroundDatasetPicker() {
  const input = usePlaygroundContext((state) => state.input);
  const setInput = usePlaygroundContext((state) => state.setInput);
  return (
    <div css={playgroundDatasetPickerCSS}>
      <DatasetPicker
        size={"compact"}
        placeholder="Test over a dataset"
        // Fallback to empty string here otherwise the picker will complain of switching from a controlled to uncontrolled component
        // It can't distinguish between undefined and intentionally null
        selectedKey={input.datasetId ?? ""}
        onSelectionChange={(datasetId) => {
          startTransition(() => {
            if (typeof datasetId === "string") {
              setInput({ ...input, datasetId });
            }
          });
        }}
      />
      <Button
        size="compact"
        variant={"default"}
        icon={<Icon svg={<Icons.CloseOutline />} />}
        onClick={() => {
          setInput({ ...input, datasetId: undefined });
        }}
      />
    </div>
  );
}
