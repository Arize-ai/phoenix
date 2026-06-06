import { css } from "@emotion/react";
import { useRef, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";
import { getTimeZoneShortName } from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

import { Badge } from "../core/badge";
import { Text } from "../core/content";
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
 * preset into a custom range, while focusing the field opens the list of quick
 * presets right below it. The leading badge surfaces the active preset's
 * shorthand and the trailing label shows the time zone the range is displayed
 * in.
 */
const timeRangeSelectorCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  height: var(--global-input-height-s);
  padding-inline: var(--global-dimension-size-100);
  background-color: var(--global-input-field-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
  transition: border-color 0.2s ease-in-out;

  /* Match the standard input field: a single border-color change for both
     hover and focus so the two states read consistently. */
  &:hover:not([data-disabled]),
  &:focus-within:not([data-disabled]) {
    border-color: var(--global-input-field-border-color-active);
  }
  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }

  .time-range-selector__fields {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
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
`;

const presetListBoxCSS = css`
  /* Fill the popover, which is sized to the field it is anchored to. */
  width: 100%;
`;

const badgeCSS = css`
  flex: none;
  font-variant-numeric: tabular-nums;
`;

export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange, size = "S" } = props;
  const { timeRangeKey, start, end } = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  // Closing after a preset click can restore focus to the date field. That
  // restored focus would otherwise retrigger `onFocus` and immediately reopen
  // the menu; this ref lets `onFocus` swallow exactly that one reopen.
  const skipNextFocusOpenRef = useRef(false);
  const suppressNextFocusOpen = () => {
    skipNextFocusOpenRef.current = true;
    setTimeout(() => {
      skipNextFocusOpenRef.current = false;
    }, 300);
  };
  // Measure the field so the presets popover can span its full width. The
  // observed content box plus the field's own padding and border reconstructs
  // the field's outer (border-box) width.
  const fieldDimensions = useDimensions(containerRef);
  const popoverWidth = fieldDimensions
    ? `calc(${fieldDimensions.width}px + 2 * var(--global-dimension-size-100) + 2 * var(--global-border-size-thin))`
    : undefined;
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
      ref={containerRef}
      className="time-range-selector"
      css={timeRangeSelectorCSS}
      data-size={size}
      data-disabled={isDisabled || undefined}
      role="group"
      aria-label="Time range"
      onFocus={() => {
        if (isDisabled) {
          return;
        }
        if (skipNextFocusOpenRef.current) {
          skipNextFocusOpenRef.current = false;
          return;
        }
        setIsPresetsOpen(true);
      }}
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
      <Popover
        triggerRef={containerRef}
        isOpen={isPresetsOpen}
        onOpenChange={setIsPresetsOpen}
        isNonModal
        placement="bottom start"
        style={{
          width: popoverWidth,
          // Match the focused field's active border so the open menu reads as a
          // continuation of the field rather than a separate, gray-bordered
          // surface.
          borderColor: "var(--global-input-field-border-color-active)",
        }}
      >
        <ListBox
          aria-label="time range preset selection"
          selectionMode="single"
          selectedKeys={isCustom ? [] : [timeRangeKey]}
          css={presetListBoxCSS}
          onSelectionChange={(selection) => {
            const selectedKey =
              selection === "all" ? undefined : selection.keys().next().value;
            // Re-clicking the active preset toggles single-selection off,
            // firing this with an empty selection; fall back to the active
            // preset so that clicking any preset — even the current one —
            // commits its (recomputed) range.
            const keyToApply = isLastNTimeRangeKey(selectedKey)
              ? selectedKey
              : isLastNTimeRangeKey(timeRangeKey)
                ? timeRangeKey
                : undefined;
            suppressNextFocusOpen();
            if (!keyToApply) {
              setIsPresetsOpen(false);
              return;
            }
            const nextRange = getTimeRangeFromLastNTimeRangeKey(keyToApply);
            setIsPresetsOpen(false);
            onChange({ timeRangeKey: keyToApply, ...nextRange });
          }}
        >
          {LAST_N_TIME_RANGES.map(({ key, label }) => (
            <ListBoxItem key={key} id={key}>
              {label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </div>
  );
}
