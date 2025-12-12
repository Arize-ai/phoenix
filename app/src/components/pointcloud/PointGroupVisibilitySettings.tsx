import { useCallback, useMemo } from "react";
import { css } from "@emotion/react";

import { Checkbox } from "@phoenix/components/checkbox";
import { usePointCloudContext } from "@phoenix/contexts/PointCloudContext";

import { VisibilityCheckboxField } from "./VisibilityCheckboxField";

/**
 * Small checkbox form that controls the visibility of each point group.
 * E.x. "true positives", "false positives", "false negatives", etc.
 */
export function PointGroupVisibilitySettings() {
  const pointGroupVisibility = usePointCloudContext(
    (state) => state.pointGroupVisibility
  );
  const setPointGroupVisibility = usePointCloudContext(
    (state) => state.setPointGroupVisibility
  );
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );

  const pointGroups = useMemo(
    () => Object.keys(pointGroupVisibility),
    [pointGroupVisibility]
  );

  const onChange = useCallback(
    (isSelected: boolean, name: string) => {
      setPointGroupVisibility({
        ...pointGroupVisibility,
        [name]: isSelected,
      });
    },
    [pointGroupVisibility, setPointGroupVisibility]
  );
  return (
    <form
      css={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <PointGroupCheckbox />
      <div
        css={css`
          padding: var(--ac-global-dimension-static-size-100);
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-static-size-50);
        `}
      >
        {pointGroups.map((groupName) => {
          const groupVisibility = pointGroupVisibility[groupName];
          const groupColor = pointGroupColors[groupName];
          return (
            <VisibilityCheckboxField
              key={groupName}
              name={groupName}
              checked={groupVisibility}
              color={groupColor}
              onChange={(isSelected) => onChange(isSelected, groupName)}
            />
          );
        })}
      </div>
    </form>
  );
}

/**
 * A checkbox that controls the entire group of points
 */
function PointGroupCheckbox() {
  const pointGroupVisibility = usePointCloudContext(
    (state) => state.pointGroupVisibility
  );
  const setPointGroupVisibility = usePointCloudContext(
    (state) => state.setPointGroupVisibility
  );
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );
  const allNotVisible = useMemo(
    () => Object.values(pointGroupVisibility).every((visible) => !visible),
    [pointGroupVisibility]
  );

  const onChange = useCallback(
    (isSelected: boolean) => {
      const newPointGroupVisibility = Object.keys(pointGroupVisibility).reduce(
        (acc, groupName) => {
          acc[groupName] = isSelected;
          return acc;
        },
        {} as Record<string, boolean>
      );
      setPointGroupVisibility(newPointGroupVisibility);
    },
    [pointGroupVisibility, setPointGroupVisibility]
  );

  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-static-size-50)
          var(--ac-global-dimension-static-size-100);
        background-color: var(--ac-global-background-color-light);
      `}
    >
      <Checkbox
        isSelected={!allNotVisible}
        name={"pointGroup"}
        onChange={onChange}
      >
        {`${coloringStrategy}`}
      </Checkbox>
    </div>
  );
}
