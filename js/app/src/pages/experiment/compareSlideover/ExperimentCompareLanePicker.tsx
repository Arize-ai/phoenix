import { css } from "@emotion/react";
import { useRef } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import {
  Button,
  ColorSwatch,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  truncateSingleCSS,
} from "@phoenix/components";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { useDimensions } from "@phoenix/hooks";

import { partitionPickerExperiments } from "./experimentCompareLanePickerLayout";

export type ExperimentCompareLanePickerOption = {
  id: string;
  name: string;
  sequenceNumber: number;
  color: string;
};

const lanePickerCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  flex: 1 1 auto;
  min-width: 0;

  .experiment-compare-lane-picker__chips {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
    flex: 1 1 auto;
    min-width: 0;
    box-sizing: border-box;
    padding: var(--global-dimension-size-25);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    background-color: var(--global-color-gray-75);
  }

  .experiment-compare-lane-picker__chip {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    flex: 0 0 auto;
    min-width: 0;
    height: var(--global-dimension-size-300);
    padding: 0 var(--global-dimension-size-100) 0
      var(--global-dimension-size-75);
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    cursor: pointer;

    &[data-hovered] {
      background-color: var(--global-color-gray-200);
    }
    &[data-selected] {
      flex: 1 1 auto;
      background-color: var(--global-color-gray-300);
      color: var(--global-text-color-900);
      font-weight: 500;
    }
    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }

  .experiment-compare-lane-picker__radio {
    flex: none;
    box-sizing: border-box;
    width: var(--global-dimension-size-150);
    height: var(--global-dimension-size-150);
    border-radius: var(--global-rounding-full);
    border: var(--global-border-size-thick) solid var(--global-text-color-300);
  }
  .experiment-compare-lane-picker__chip[data-selected]
    .experiment-compare-lane-picker__radio {
    border: var(--global-dimension-size-50) solid var(--global-color-primary);
    background-color: var(--global-background-color-default);
  }

  .experiment-compare-lane-picker__swatch,
  .experiment-compare-lane-picker__sequence-number {
    flex: none;
    display: inline-flex;
  }

  .experiment-compare-lane-picker__name {
    min-width: 0;
    ${truncateSingleCSS}
  }
`;

const menuItemContentCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
`;

/**
 * Picks which compared experiment the right lane shows. Experiments are
 * radio chips while they fit: the selected one shows its name, the others
 * collapse to swatch and sequence number. Experiments that do not fit move
 * into a `+N` menu, and the selected experiment always stays a chip.
 */
export function ExperimentCompareLanePicker({
  options,
  selectedExperimentId,
  onSelectionChange,
}: {
  /** The compared experiments, in display order */
  options: readonly ExperimentCompareLanePickerOption[];
  selectedExperimentId: string;
  onSelectionChange: (experimentId: string) => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(pickerRef);
  const { chipExperimentIds, overflowExperimentIds } =
    partitionPickerExperiments({
      experimentIds: options.map((option) => option.id),
      selectedExperimentId,
      availableWidth: dimensions?.width ?? null,
    });
  const chipOptions = options.filter((option) =>
    chipExperimentIds.includes(option.id)
  );
  const overflowOptions = options.filter((option) =>
    overflowExperimentIds.includes(option.id)
  );
  return (
    <div
      ref={pickerRef}
      className="experiment-compare-lane-picker"
      css={lanePickerCSS}
    >
      <RadioGroup
        aria-label="Compare with"
        orientation="horizontal"
        className="experiment-compare-lane-picker__chips"
        value={selectedExperimentId}
        onChange={onSelectionChange}
      >
        {chipOptions.map((option) => (
          <Radio
            key={option.id}
            value={option.id}
            aria-label={`#${option.sequenceNumber} ${option.name}`}
            className="experiment-compare-lane-picker__chip"
          >
            {({ isSelected }) => (
              <>
                <span className="experiment-compare-lane-picker__radio" />
                <span className="experiment-compare-lane-picker__swatch">
                  <ColorSwatch color={option.color} shape="circle" />
                </span>
                <span className="experiment-compare-lane-picker__sequence-number">
                  <SequenceNumberToken sequenceNumber={option.sequenceNumber} />
                </span>
                {isSelected ? (
                  <span
                    className="experiment-compare-lane-picker__name"
                    title={option.name}
                  >
                    {option.name}
                  </span>
                ) : null}
              </>
            )}
          </Radio>
        ))}
      </RadioGroup>
      {overflowOptions.length > 0 ? (
        <MenuTrigger>
          <Button
            size="S"
            aria-label={`${overflowOptions.length} more experiments`}
            trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
          >
            +{overflowOptions.length}
          </Button>
          <Popover placement="bottom end">
            <Menu
              aria-label="More experiments"
              onAction={(key) => onSelectionChange(String(key))}
            >
              {overflowOptions.map((option) => (
                <MenuItem
                  key={option.id}
                  id={option.id}
                  textValue={`#${option.sequenceNumber} ${option.name}`}
                >
                  <span css={menuItemContentCSS}>
                    <ColorSwatch color={option.color} shape="circle" />
                    <SequenceNumberToken
                      sequenceNumber={option.sequenceNumber}
                    />
                    <span css={truncateSingleCSS}>{option.name}</span>
                  </span>
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      ) : null}
    </div>
  );
}
