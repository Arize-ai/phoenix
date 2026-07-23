import { css } from "@emotion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFilter, useInteractOutside } from "react-aria";
import { Autocomplete, Input } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import { usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";
import {
  createTimeRangeFormatter,
  getTimeZoneShortName,
} from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

import { Badge } from "../core/badge";
import { Button } from "../core/button";
import { Text } from "../core/content";
import { SearchField, SearchIcon } from "../core/field";
import { Icon, Icons } from "../core/icon";
import { ListBox, ListBoxItem } from "../core/listbox";
import { MenuFooter } from "../core/menu";
import { Popover } from "../core/overlay";
import type { ComponentSize } from "../core/types";
import { LAST_N_TIME_RANGES } from "./constants";
import { TimeRangeCalendarPicker } from "./TimeRangeCalendarPicker";
import { TimeRangeFields } from "./TimeRangeFields";
import type { TimeRangeFieldsHandle } from "./TimeRangeFields";
import type { OpenTimeRangeWithKey } from "./types";
import {
  getLastNTimeRangeLabel,
  getTimeRangeFromLastNTimeRangeKey,
  getTimeRangeSearchSuggestions,
  isLastNTimeRangeKey,
} from "./utils";

export type TimeRangeSelectorProps = {
  /** Prevents edits and preset selection while preserving the displayed range. */
  isDisabled?: boolean;
  /** The currently committed range, including its preset key. */
  value: OpenTimeRangeWithKey;
  /** Called when a preset is selected or inline date edits commit. */
  onChange: (timeRange: OpenTimeRangeWithKey) => void;
  /** Visual size for the selector shell. */
  size?: ComponentSize;
};

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
  cursor: pointer;
  transition: border-color 0.2s ease-in-out;

  /* Match the standard input field: a single border-color change for both
     hover and focus so the two states read consistently. */
  &:hover:not([data-disabled]),
  &[data-presets-open]:not([data-disabled]) {
    border-color: var(--global-input-field-border-color-active);
  }
  &:focus-within:not([data-disabled]) {
    border-color: var(--global-input-field-border-color-active);
  }
  &:has(:focus-visible):not([data-disabled]) {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
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

  .time-range-selector__value-shell {
    flex: 0 0 auto;
    min-width: 0;
    overflow: hidden;
    transition: width 180ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }

  .time-range-selector__value-measure {
    display: inline-flex;
    align-items: center;
    width: max-content;
  }

  .time-range-selector__value {
    flex: 0 1 auto;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--global-text-color-900);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;

    &:focus {
      outline: none;
    }

    &[disabled] {
      cursor: not-allowed;
    }
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
    transition:
      color 0.1s ease-out,
      background-color 0.1s ease-out;

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
      color: var(--field-editing-foreground);
      background: var(--field-editing-background);
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

  &[data-presets-open] .time-range-selector__value-shell {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .time-range-selector__value-shell {
      transition: none;
    }
  }
`;

const presetListBoxCSS = css`
  /* Fill the popover, which is sized to the field it is anchored to. */
  width: 100%;
`;

const presetEmptyStateCSS = css`
  padding: var(--global-dimension-size-200) var(--global-dimension-size-150);
`;

const presetSearchCSS = css`
  width: 100%;
  border-bottom: var(--global-border-size-thin) solid
    var(--global-menu-border-color);
`;

const badgeCSS = css`
  flex: none;
  font-variant-numeric: tabular-nums;
`;

const calendarOptionCSS = css`
  width: 100%;
  justify-content: flex-start;
`;

const OPEN_VALUE_MIN_WIDTH = "var(--global-dimension-size-4000)";

/**
 * An inline, editable time range control. The current window is shown as a
 * compact preset label until the control receives focus, then swaps to editable
 * start/end date fields. Typing into the dates forks the active preset into a
 * custom range, while focusing the control opens the list of quick presets
 * right below it. A search field at the top of the presets filters the list
 * and parses free-form durations ("25m", "2 hours") into ad-hoc last-N
 * options. The leading badge surfaces the active preset's shorthand and the
 * trailing label shows the time zone the range is displayed in.
 */
export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange, size = "S" } = props;
  const { timeRangeKey, start, end } = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const valueMeasureRef = useRef<HTMLDivElement>(null);
  const valueButtonRef = useRef<HTMLButtonElement>(null);
  const timeRangeFieldsRef = useRef<TimeRangeFieldsHandle | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState(false);
  const [popoverWidth, setPopoverWidth] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const closePresets = useCallback(() => {
    setIsPresetsOpen(false);
    setIsCalendarPickerOpen(false);
    setSearchText("");
  }, []);
  // The focused element belongs to this control if it lives inside the trigger
  // or its popover. Used to decide whether losing focus should stop editing.
  const getFocusedElementWithin = useCallback(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (containerRef.current?.contains(activeElement) ||
        popoverRef.current?.contains(activeElement))
    ) {
      return activeElement;
    }
    return null;
  }, []);
  const closeEditingIfFocusOutside = useCallback(() => {
    setTimeout(() => {
      if (getFocusedElementWithin()) {
        return;
      }
      setIsEditing(false);
      closePresets();
    });
  }, [closePresets, getFocusedElementWithin]);
  const blurFocusedTimeRangeElement = useCallback(() => {
    getFocusedElementWithin()?.blur();
  }, [getFocusedElementWithin]);
  const submitTimeRangeField = useCallback(() => {
    blurFocusedTimeRangeElement();
    setIsEditing(false);
    closePresets();
  }, [blurFocusedTimeRangeElement, closePresets]);
  const commitAndBlurTimeRangeField = useCallback(() => {
    timeRangeFieldsRef.current?.commit();
    submitTimeRangeField();
  }, [submitTimeRangeField]);
  const openPresets = useCallback(() => {
    setIsPresetsOpen(true);
  }, []);

  // A press outside both the trigger and the (portaled) presets popover commits
  // the edit and fully closes. The full teardown matters: react-aria restores
  // focus into the fields when the popover unmounts, so only closing the popover
  // would leave the control open and require a second click to blur.
  useInteractOutside({
    ref: containerRef,
    isDisabled: !isPresetsOpen,
    onInteractOutside: (event) => {
      if (
        event.target instanceof Node &&
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      commitAndBlurTimeRangeField();
    },
  });

  // Escape commits the field state and closes. Capture + stopPropagation keep
  // the popover's own Escape dismissal from running, which would restore focus
  // to the trigger and reopen the control via its onFocus.
  useHotkeys(
    "escape",
    (event) => {
      event.stopPropagation();
      // Escape from a non-empty search clears the search before a second
      // press closes the control, matching standard search field behavior.
      if (searchText && document.activeElement === searchInputRef.current) {
        setSearchText("");
        return;
      }
      commitAndBlurTimeRangeField();
    },
    {
      enabled: isEditing,
      // The date segments are form fields rendered as contentEditable spans, so
      // both flags are needed for Escape to fire while one of them is focused.
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
      eventListenerOptions: { capture: true },
    }
  );

  const valueDimensions = useDimensions(valueMeasureRef);
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );
  const timeZone = displayTimezone ?? getTimeZone();
  const locale = getLocale();
  const timeZoneShortName = getTimeZoneShortName({
    locale,
    timeZone,
  });

  const isCustom = timeRangeKey === "custom";
  const badgeLabel = isCustom ? "Custom" : timeRangeKey;
  const timeRangeFormatter = createTimeRangeFormatter({ locale, timeZone });
  const valueLabel = isLastNTimeRangeKey(timeRangeKey)
    ? getLastNTimeRangeLabel(timeRangeKey)
    : timeRangeFormatter({ start, end });

  // A duration typed into the search (e.g. "25m") becomes a selectable
  // "Last 25 minutes" option ahead of the presets, and a bare quantity
  // ("25") suggests it in every unit. Colliding presets are dropped so each
  // option appears once.
  const searchSuggestions = getTimeRangeSearchSuggestions(searchText);
  const presetItems = LAST_N_TIME_RANGES.filter(
    ({ key }) => !searchSuggestions.includes(key)
  );

  // Forces the inline fields to reset whenever the committed range or the
  // display time zone changes from the outside (e.g. selecting a preset).
  const fieldsKey = `${timeRangeKey}|${start?.getTime() ?? ""}|${end?.getTime() ?? ""}|${timeZone}`;
  const valueWidth = valueDimensions?.width;
  const triggerLayoutKey = `${isEditing}|${fieldsKey}|${valueLabel}|${badgeLabel}|${timeZoneShortName ?? ""}`;
  const isPopoverReady = isPresetsOpen && popoverWidth != null;

  /**
   * Uses the compact value button as the only focus target while making the
   * badge, padding, and time zone label behave like the same trigger.
   */
  const handleSelectorPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (isDisabled || isEditing) {
      return;
    }

    const valueButton = valueButtonRef.current;
    const isValueButtonTarget =
      event.target instanceof Node && valueButton?.contains(event.target);
    if (!valueButton || isValueButtonTarget) {
      return;
    }

    event.preventDefault();
    valueButton.focus();
  };

  useLayoutEffect(() => {
    const width = isPresetsOpen ? containerRef.current?.offsetWidth : undefined;
    const nextWidth = width ? `${width}px` : undefined;
    // Measure after the edit fields have laid out, but before paint, so the
    // popover mounts at the final trigger width instead of resizing from the
    // compact-label width.
    // eslint-disable-next-line react-hooks-js/set-state-in-effect
    setPopoverWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth
    );
  }, [isPresetsOpen, triggerLayoutKey]);

  useLayoutEffect(() => {
    if (!isPopoverReady || isCalendarPickerOpen) {
      return;
    }
    // Also refocuses the search when the calendar picker closes back to the
    // presets list.
    searchInputRef.current?.focus();
  }, [isPopoverReady, isCalendarPickerOpen]);

  return (
    <>
      <div
        ref={containerRef}
        className="time-range-selector"
        css={timeRangeSelectorCSS}
        data-size={size}
        data-disabled={isDisabled || undefined}
        data-presets-open={isPresetsOpen || undefined}
        role="group"
        aria-label="Time range"
        onPointerDown={handleSelectorPointerDown}
      >
        <Badge size="S" variant={isCustom ? "info" : "default"} css={badgeCSS}>
          {badgeLabel}
        </Badge>
        <div
          className="time-range-selector__value-shell"
          style={{
            width: isPresetsOpen || valueWidth == null ? "auto" : valueWidth,
            minWidth: isEditing ? OPEN_VALUE_MIN_WIDTH : undefined,
          }}
        >
          <div
            ref={valueMeasureRef}
            className="time-range-selector__value-measure"
          >
            {isEditing ? (
              <TimeRangeFields
                key={fieldsKey}
                ref={timeRangeFieldsRef}
                start={start}
                end={end}
                timeZone={timeZone}
                isDisabled={isDisabled}
                autoFocus
                onBlurWithin={closeEditingIfFocusOutside}
                onSubmit={submitTimeRangeField}
                onCommit={(timeRange) =>
                  onChange({ timeRangeKey: "custom", ...timeRange })
                }
              />
            ) : (
              <button
                ref={valueButtonRef}
                type="button"
                className="time-range-selector__value"
                disabled={isDisabled}
                onFocus={() => {
                  if (isDisabled) {
                    return;
                  }
                  setIsEditing(true);
                  openPresets();
                }}
              >
                {valueLabel}
              </button>
            )}
          </div>
        </div>
        {timeZoneShortName && (
          <Text
            size="XS"
            color="text-500"
            className="time-range-selector__timezone"
          >
            {timeZoneShortName}
          </Text>
        )}
      </div>
      <Popover
        ref={popoverRef}
        triggerRef={containerRef}
        isOpen={isPopoverReady}
        // react-aria only requests a close here (e.g. the trigger scrolls out
        // of view); opening is driven entirely by focusing the control.
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closePresets();
          }
        }}
        isNonModal
        // Escape is owned by the hotkey above (which also commits the edit).
        isKeyboardDismissDisabled
        // The calendar picker is wider than the trigger, so it hangs off the
        // trigger's right edge to read as one clean column.
        placement={isCalendarPickerOpen ? "bottom end" : "bottom start"}
        offset={2}
        style={{
          // The presets menu hugs the trigger; the calendar picker is content
          // sized but never narrower than the trigger.
          width: isCalendarPickerOpen ? "max-content" : popoverWidth,
          minWidth: isCalendarPickerOpen ? popoverWidth : undefined,
          // Clip full-bleed rows (the search header and calendar footer) to
          // the popover's rounded corners.
          overflow: "hidden",
          // The popover keeps the standard menu chrome; only the open/resize
          // animations are suppressed because opening is driven by focus and
          // the width follows the trigger as the user edits the dates.
          transition: "none",
          animation: "none",
          transform: "translateY(0)",
          opacity: 1,
        }}
      >
        {isCalendarPickerOpen ? (
          <TimeRangeCalendarPicker
            value={{ start, end }}
            timeZone={timeZone}
            onCancel={() => setIsCalendarPickerOpen(false)}
            onApply={(range) => {
              setIsEditing(false);
              closePresets();
              onChange({ timeRangeKey: "custom", ...range });
            }}
          />
        ) : (
          <>
            <Autocomplete filter={contains}>
              <SearchField
                aria-label="Search time range presets"
                size="M"
                variant="quiet"
                value={searchText}
                onChange={setSearchText}
                css={presetSearchCSS}
              >
                <SearchIcon />
                <Input
                  ref={searchInputRef}
                  placeholder='Search or type "25m"'
                  onBlur={closeEditingIfFocusOutside}
                />
              </SearchField>
              <ListBox
                aria-label="time range preset selection"
                selectionMode="single"
                selectedKeys={isCustom ? [] : [timeRangeKey]}
                css={presetListBoxCSS}
                renderEmptyState={() => (
                  <div css={presetEmptyStateCSS}>No matching time ranges</div>
                )}
                onSelectionChange={(selection) => {
                  const selectedKey =
                    selection === "all"
                      ? undefined
                      : selection.keys().next().value;
                  // Re-clicking the active preset toggles single-selection off,
                  // firing this with an empty selection; fall back to the active
                  // preset so that clicking any preset — even the current one —
                  // commits its (recomputed) range.
                  const keyToApply = isLastNTimeRangeKey(selectedKey)
                    ? selectedKey
                    : isLastNTimeRangeKey(timeRangeKey)
                      ? timeRangeKey
                      : undefined;
                  setIsEditing(false);
                  if (!keyToApply) {
                    closePresets();
                    return;
                  }
                  const nextRange =
                    getTimeRangeFromLastNTimeRangeKey(keyToApply);
                  closePresets();
                  onChange({ timeRangeKey: keyToApply, ...nextRange });
                }}
              >
                {searchSuggestions.map((suggestedKey) => (
                  // The search text itself is the text value so suggestions always
                  // survive the autocomplete filter (their labels may not contain
                  // the raw input, e.g. "25m" vs "Last 25 minutes").
                  <ListBoxItem
                    key={suggestedKey}
                    id={suggestedKey}
                    textValue={searchText}
                  >
                    {getLastNTimeRangeLabel(suggestedKey)}
                  </ListBoxItem>
                ))}
                {presetItems.map(({ key, label }) => (
                  <ListBoxItem key={key} id={key}>
                    {label}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Autocomplete>
            <MenuFooter>
              <Button
                size="S"
                variant="quiet"
                css={calendarOptionCSS}
                leadingVisual={<Icon svg={<Icons.Calendar />} />}
                onPress={() => setIsCalendarPickerOpen(true)}
              >
                Pick from a calendar
              </Button>
            </MenuFooter>
          </>
        )}
      </Popover>
    </>
  );
}
