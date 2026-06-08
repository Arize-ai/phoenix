import { css } from "@emotion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";
import {
  createTimeRangeFormatter,
  getTimeZoneShortName,
} from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

import { Badge } from "../core/badge";
import { Text } from "../core/content";
import { ListBox, ListBoxItem } from "../core/listbox";
import { Popover } from "../core/overlay";
import type { ComponentSize } from "../core/types";
import { LAST_N_TIME_RANGES, LAST_N_TIME_RANGES_MAP } from "./constants";
import { TimeRangeFields } from "./TimeRangeFields";
import type { TimeRangeFieldsHandle } from "./TimeRangeFields";
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
 * A Datadog-style time range control. The current window is shown as a compact
 * preset label until the control receives focus, then swaps to inline editable
 * start/end date fields. Typing into the dates forks the active preset into a
 * custom range, while focusing the control opens the list of quick presets
 * right below it. The leading badge surfaces the active preset's shorthand and
 * the trailing label shows the time zone the range is displayed in.
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

const badgeCSS = css`
  flex: none;
  font-variant-numeric: tabular-nums;
`;

export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange, size = "S" } = props;
  const { timeRangeKey, start, end } = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const presetListBoxRef = useRef<HTMLDivElement>(null);
  const valueMeasureRef = useRef<HTMLDivElement>(null);
  const timeRangeFieldsRef = useRef<TimeRangeFieldsHandle | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [popoverWidth, setPopoverWidth] = useState<string | undefined>();
  // Closing after a preset click can trigger focus restoration and delayed
  // open requests. Suppress those briefly so a preset selection closes cleanly.
  const suppressOpenRef = useRef(false);
  const suppressNextOpen = () => {
    suppressOpenRef.current = true;
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 300);
  };
  const closePresets = useCallback(() => {
    setIsPresetsOpen(false);
  }, []);
  const blurFocusedTimeRangeElement = useCallback(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (containerRef.current?.contains(activeElement) ||
        popoverRef.current?.contains(activeElement))
    ) {
      activeElement.blur();
    }
  }, []);
  const commitAndBlurTimeRangeField = useCallback(() => {
    timeRangeFieldsRef.current?.commit();
    blurFocusedTimeRangeElement();
    setIsEditing(false);
  }, [blurFocusedTimeRangeElement]);
  const openPresets = useCallback(() => {
    if (suppressOpenRef.current) {
      return;
    }
    setIsPresetsOpen((isOpen) => (isOpen ? isOpen : true));
  }, []);
  useEffect(() => {
    if (!isPresetsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (
        containerRef.current?.contains(event.target) ||
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      closePresets();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      commitAndBlurTimeRangeField();
      closePresets();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closePresets, commitAndBlurTimeRangeField, isPresetsOpen]);

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
    ? (LAST_N_TIME_RANGES_MAP[timeRangeKey]?.label ?? timeRangeKey)
    : timeRangeFormatter({ start, end });

  // Forces the inline fields to reset whenever the committed range or the
  // display time zone changes from the outside (e.g. selecting a preset).
  const fieldsKey = `${timeRangeKey}|${start?.getTime() ?? ""}|${end?.getTime() ?? ""}|${timeZone}`;
  const valueWidth = valueDimensions?.width;
  const triggerLayoutKey = `${isEditing}|${fieldsKey}|${valueLabel}|${badgeLabel}|${timeZoneShortName ?? ""}`;
  const isPopoverReady = isPresetsOpen && popoverWidth != null;

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
    if (!isPopoverReady) {
      return;
    }
    presetListBoxRef.current?.focus();
  }, [isPopoverReady]);

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
      >
        <Badge size="S" variant={isCustom ? "info" : "default"} css={badgeCSS}>
          {badgeLabel}
        </Badge>
        <div
          className="time-range-selector__value-shell"
          style={{
            width: isPresetsOpen || valueWidth == null ? "auto" : valueWidth,
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
                onBlurWithin={() => setIsEditing(false)}
                onCommit={(timeRange) =>
                  onChange({ timeRangeKey: "custom", ...timeRange })
                }
              />
            ) : (
              <button
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
        onOpenChange={(isOpen) => {
          if (isOpen && suppressOpenRef.current) {
            return;
          }
          setIsPresetsOpen(isOpen);
        }}
        isNonModal
        placement="bottom start"
        offset={2}
        style={{
          width: popoverWidth,
          // Match the focused field's active border so the open menu reads as a
          // continuation of the field rather than a separate, gray-bordered
          // surface.
          borderColor: "var(--global-input-field-border-color-active)",
          boxShadow: "none",
          transition: "none",
          animation: "none",
          transform: "translateY(0)",
          opacity: 1,
        }}
      >
        <ListBox
          ref={presetListBoxRef}
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
            suppressNextOpen();
            setIsEditing(false);
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
    </>
  );
}
