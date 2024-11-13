import React, { startTransition } from "react";
import { useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@arizeai/components";

import { DatasetPicker } from "@phoenix/components/dataset";

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
          startTransition(() => {
            if (typeof datasetId === "string") {
              navigate(`/playground/datasets/${datasetId}`);
            }
          });
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
