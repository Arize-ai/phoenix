import { css } from "@emotion/react";
import { Dialog, DialogTrigger } from "react-aria-components";

import { usePreferencesContext } from "@phoenix/contexts";
import { getTimeZoneShortName } from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

import { Badge } from "../core/badge";
import { IconButton } from "../core/button";
import { Text } from "../core/content";
import { SelectChevronUpDownIcon } from "../core/icon";
import { ListBox, ListBoxItem } from "../core/listbox";
import { Popover } from "../core/overlay";
import type { ComponentSize } from "../core/types";
import { LAST_N_TIME_RANGES } from "./constants";
import { TimeRangeFields } from "./TimeRangeFields";
import type { OpenTimeRangeWithKey } from "./types";
import {
  getTimeRangeFromLastNTimeRangeKey,
  isLastNTimeRangeKey,
} from "./utils";

export type TimeRangeSelectorProps = {
  isDisabled?: boolean;
  value: OpenTimeRangeWithKey;
  onChange: (timeRange: OpenTimeRangeWithKey) => void;
  size?: ComponentSize;
};

/**
 * A Datadog-style time range control. The current window is always shown as an
 * inline, editable field: typing into the start/end dates forks the active
 * preset into a custom range, while the chevron opens the list of quick
 * presets. The leading badge surfaces the active preset's shorthand and the
 * trailing label shows the time zone the range is displayed in.
 */
const timeRangeSelectorCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  box-sizing: border-box;
  width: 470px;
  max-width: 100%;
  height: var(--global-input-height-s);
  padding-inline: var(--global-dimension-size-100)
    var(--global-dimension-size-25);
  background-color: var(--global-input-field-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
  transition:
    border-color 0.2s ease-in-out,
    outline-color 0.2s ease-in-out;
  outline: var(--global-border-size-thin) solid transparent;
  outline-offset: -1px;

  &:hover:not([data-disabled]) {
    border-color: var(--global-input-field-border-color-active);
  }
  &:focus-within:not([data-disabled]) {
    border-color: var(--global-input-field-border-color-active);
    outline-color: var(--global-input-field-border-color-active);
  }
  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }

  .time-range-selector__fields {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }

  .time-range-selector__separator {
    flex: none;
    color: var(--global-text-color-500);
  }

  .react-aria-DateInput {
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding-block: 2px;
    width: fit-content;
    forced-color-adjust: none;
  }

  .react-aria-DateSegment {
    padding: 0 1px;
    font-variant-numeric: tabular-nums;
    color: var(--global-text-color-900);
    border-radius: var(--global-rounding-xsmall);

    &[data-type="literal"] {
      padding: 0;
      /* Preserve the locale separator (e.g. ", ") that flex would collapse. */
      white-space: pre;
    }
    &[data-placeholder] {
      color: var(--text-color-placeholder);
      font-style: italic;
    }
    &[data-disabled] {
      color: var(--global-text-color-500);
    }
    &:focus {
      color: var(--highlight-foreground);
      background: var(--highlight-background);
      outline: none;
      caret-color: transparent;
    }
  }

  .time-range-selector__fields[data-invalid] .react-aria-DateSegment {
    color: var(--global-color-danger);
  }

  .time-range-selector__timezone {
    flex: none;
    white-space: nowrap;
  }

  .time-range-selector__presets-trigger {
    flex: none;
  }
`;

const presetListBoxCSS = css`
  width: 160px;
`;

const badgeCSS = css`
  flex: none;
  font-variant-numeric: tabular-nums;
`;

export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange, size = "S" } = props;
  const { timeRangeKey, start, end } = value;
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );
  const timeZone = displayTimezone ?? getTimeZone();
  const timeZoneShortName = getTimeZoneShortName({
    locale: getLocale(),
    timeZone,
  });

  const isCustom = timeRangeKey === "custom";
  const badgeLabel = isCustom ? "Custom" : timeRangeKey;

  // Forces the inline fields to reset whenever the committed range or the
  // display time zone changes from the outside (e.g. selecting a preset).
  const fieldsKey = `${timeRangeKey}|${start?.getTime() ?? ""}|${end?.getTime() ?? ""}|${timeZone}`;

  return (
    <div
      className="time-range-selector"
      css={timeRangeSelectorCSS}
      data-size={size}
      data-disabled={isDisabled || undefined}
      role="group"
      aria-label="Time range"
    >
      <Badge size="S" variant={isCustom ? "info" : "default"} css={badgeCSS}>
        {badgeLabel}
      </Badge>
      <TimeRangeFields
        key={fieldsKey}
        start={start}
        end={end}
        timeZone={timeZone}
        isDisabled={isDisabled}
        onCommit={(timeRange) =>
          onChange({ timeRangeKey: "custom", ...timeRange })
        }
      />
      {timeZoneShortName && (
        <Text
          size="XS"
          color="text-500"
          className="time-range-selector__timezone"
        >
          {timeZoneShortName}
        </Text>
      )}
      <DialogTrigger>
        <IconButton
          size="S"
          isDisabled={isDisabled}
          aria-label="Choose a preset time range"
          className="time-range-selector__presets-trigger"
        >
          <SelectChevronUpDownIcon />
        </IconButton>
        <Popover placement="bottom end">
          <Dialog>
            {({ close }) => (
              <ListBox
                aria-label="time range preset selection"
                selectionMode="single"
                autoFocus
                selectedKeys={isCustom ? [] : [timeRangeKey]}
                css={presetListBoxCSS}
                onSelectionChange={(selection) => {
                  if (selection === "all") {
                    close();
                    return;
                  }
                  const selectedKey = selection.keys().next().value;
                  if (!isLastNTimeRangeKey(selectedKey)) {
                    return;
                  }
                  onChange({
                    timeRangeKey: selectedKey,
                    ...getTimeRangeFromLastNTimeRangeKey(selectedKey),
                  });
                  close();
                }}
              >
                {LAST_N_TIME_RANGES.map(({ key, label }) => (
                  <ListBoxItem key={key} id={key}>
                    {label}
                  </ListBoxItem>
                ))}
              </ListBox>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}
