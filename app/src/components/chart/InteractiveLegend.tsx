import { css } from "@emotion/react";
import { cloneElement, createElement, isValidElement, useState } from "react";
import type { MouseEvent } from "react";
import type {
  DefaultLegendContentProps,
  LegendPayload,
  LegendProps,
  LegendType,
  SymbolsProps,
} from "recharts";
import { Legend, Surface, Symbols } from "recharts";

/**
 * InteractiveLegend is intentionally larger than a thin `<Legend />` wrapper.
 *
 * Recharts still owns legend placement, sizing, portals, payload sorting, and
 * custom `content` composition. This component only intercepts the payload that
 * Recharts passes to legend content so hidden series are marked inactive, then
 * swaps the default legend item markup from inert list items to accessible
 * buttons that can toggle chart series.
 *
 * The default renderer below mirrors the parts of Recharts' DefaultLegendContent
 * that Phoenix charts rely on: formatter handling, icon rendering, inactive
 * color, label styles, Recharts class names, and item event callbacks.
 */

/**
 * Recharts data keys can also be functions. Interactive hiding needs a stable
 * primitive key that can be stored in a Set and passed back to chart items'
 * `hide` props, so function data keys are rendered but not made toggleable.
 */
export type InteractiveLegendDataKey = Extract<
  NonNullable<LegendPayload["dataKey"]>,
  string | number
>;

type RechartsSymbolType = SymbolsProps["type"];

/**
 * Recharts adds `content` to the props passed into custom legend content, but
 * the exported DefaultLegendContentProps type does not include it.
 */
type RechartsLegendContentProps = DefaultLegendContentProps & {
  content?: LegendProps["content"];
};

type InteractiveLegendContentProps = RechartsLegendContentProps & {
  baseContent?: LegendProps["content"];
  hiddenDataKeys: ReadonlySet<InteractiveLegendDataKey>;
  onToggleDataKey: (dataKey: InteractiveLegendDataKey) => void;
  additionalLegendItems?: ReadonlyArray<LegendPayload>;
};

export type InteractiveLegendProps = LegendProps & {
  hiddenDataKeys: ReadonlySet<InteractiveLegendDataKey>;
  onToggleDataKey: (dataKey: InteractiveLegendDataKey) => void;
  /**
   * Additional entries appended after Recharts' generated series. Entries
   * without a data key are rendered as static, non-interactive items.
   */
  additionalLegendItems?: ReadonlyArray<LegendPayload>;
};

export type UseInteractiveLegendProps = {
  defaultHiddenDataKeys?: Iterable<InteractiveLegendDataKey>;
};

// Recharts DefaultLegendContent renders every icon inside a 32x32 viewBox.
const LEGEND_ICON_VIEW_BOX_SIZE = 32;

const legendCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-100) var(--global-dimension-size-150);
  list-style: none;
  margin: 0;
  padding: 0;
`;

const verticalLegendCSS = css`
  flex-direction: column;
  align-items: flex-start;
`;

const leftAlignedLegendCSS = css`
  justify-content: flex-start;
`;

const centerAlignedLegendCSS = css`
  justify-content: center;
`;

const rightAlignedLegendCSS = css`
  justify-content: flex-end;
`;

const legendItemCSS = css`
  display: inline-flex;
  align-items: center;
`;

const legendButtonCSS = css`
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--chart-legend-text-color);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-height: var(--global-dimension-size-200);
  padding: 0 var(--global-dimension-size-25);
  font: inherit;
  line-height: var(--global-line-height-xs);

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--global-rounding-small);
  }

  &[data-inactive="true"] {
    opacity: 0.55;
  }
`;

const legendStaticItemCSS = css`
  color: var(--chart-legend-text-color);
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-height: var(--global-dimension-size-200);
  padding: 0 var(--global-dimension-size-25);
  line-height: var(--global-line-height-xs);
`;

function getInteractiveDataKey(
  dataKey: LegendPayload["dataKey"]
): InteractiveLegendDataKey | null {
  if (typeof dataKey === "string" || typeof dataKey === "number") {
    return dataKey;
  }
  return null;
}

/**
 * Builds a label for accessibility and fallback display. Recharts legend
 * payloads normally have `value`, but custom payloads can omit it.
 */
function getLegendItemText(entry: LegendPayload) {
  if (entry.value != null) {
    return entry.value;
  }
  const dataKey = getInteractiveDataKey(entry.dataKey);
  return dataKey == null ? "Series" : String(dataKey);
}

function getLegendItemAriaLabel({
  isHidden,
  label,
}: {
  isHidden: boolean;
  label: string;
}) {
  return isHidden ? `Show ${label}` : `Hide ${label}`;
}

function getLegendAlignmentCSS(align: DefaultLegendContentProps["align"]) {
  if (align === "left") {
    return leftAlignedLegendCSS;
  }
  if (align === "right") {
    return rightAlignedLegendCSS;
  }
  return centerAlignedLegendCSS;
}

/**
 * Mirrors Recharts' default legend icon renderer so built-in `iconType`,
 * `entry.type`, `entry.legendIcon`, and line dash behavior keep working.
 */
function LegendIcon({
  entry,
  iconSize,
  iconType,
  inactiveColor,
}: {
  entry: LegendPayload;
  iconSize: number;
  iconType?: LegendType;
  inactiveColor: string;
}) {
  const isStaticEntry = getInteractiveDataKey(entry.dataKey) == null;
  const preferredIconType = isStaticEntry
    ? entry.type
    : (iconType ?? entry.type);
  const color = entry.inactive ? inactiveColor : (entry.color ?? inactiveColor);
  const halfSize = LEGEND_ICON_VIEW_BOX_SIZE / 2;
  const thirdSize = LEGEND_ICON_VIEW_BOX_SIZE / 3;
  const sixthSize = LEGEND_ICON_VIEW_BOX_SIZE / 6;

  if (preferredIconType === "none") {
    return null;
  }

  const icon = (() => {
    switch (preferredIconType) {
      case "plainline":
        return (
          <line
            className="recharts-legend-icon"
            fill="none"
            stroke={color}
            strokeDasharray={
              entry.payload &&
              "strokeDasharray" in entry.payload &&
              typeof entry.payload.strokeDasharray !== "undefined"
                ? String(entry.payload.strokeDasharray)
                : undefined
            }
            strokeWidth={4}
            x1={0}
            x2={LEGEND_ICON_VIEW_BOX_SIZE}
            y1={halfSize}
            y2={halfSize}
          />
        );
      case "line":
        return (
          <path
            className="recharts-legend-icon"
            d={`M0,${halfSize}h${thirdSize} A${sixthSize},${sixthSize},0,1,1,${2 * thirdSize},${halfSize} H${LEGEND_ICON_VIEW_BOX_SIZE} M${2 * thirdSize},${halfSize} A${sixthSize},${sixthSize},0,1,1,${thirdSize},${halfSize}`}
            fill="none"
            stroke={color}
            strokeWidth={4}
          />
        );
      case "rect":
        return (
          <path
            className="recharts-legend-icon"
            d={`M0,${LEGEND_ICON_VIEW_BOX_SIZE / 8}h${LEGEND_ICON_VIEW_BOX_SIZE}v${(LEGEND_ICON_VIEW_BOX_SIZE * 3) / 4}h${-LEGEND_ICON_VIEW_BOX_SIZE}z`}
            fill={color}
            stroke="none"
          />
        );
      default: {
        if (isValidElement<LegendPayload>(entry.legendIcon)) {
          const { legendIcon: _legendIcon, ...legendIconProps } = entry;
          return cloneElement(entry.legendIcon, legendIconProps);
        }
        const symbolType: RechartsSymbolType = preferredIconType;
        return (
          <Symbols
            className="recharts-legend-icon"
            cx={halfSize}
            cy={halfSize}
            fill={color}
            size={LEGEND_ICON_VIEW_BOX_SIZE}
            sizeType="diameter"
            type={symbolType}
          />
        );
      }
    }
  })();

  return (
    <Surface
      aria-hidden="true"
      focusable="false"
      height={iconSize}
      viewBox={{
        x: 0,
        y: 0,
        width: LEGEND_ICON_VIEW_BOX_SIZE,
        height: LEGEND_ICON_VIEW_BOX_SIZE,
      }}
      width={iconSize}
    >
      {icon}
    </Surface>
  );
}

/**
 * Marks the Recharts payload as inactive without changing the rest of the
 * payload shape. This lets both Phoenix's default renderer and user-supplied
 * custom legend content receive the normal Recharts payload plus hide state.
 */
function getEnhancedPayload({
  hiddenDataKeys,
  payload,
}: {
  hiddenDataKeys: ReadonlySet<InteractiveLegendDataKey>;
  payload?: ReadonlyArray<LegendPayload>;
}) {
  return payload?.map((entry) => {
    const dataKey = getInteractiveDataKey(entry.dataKey);
    const isHidden =
      entry.inactive === true ||
      (dataKey != null && hiddenDataKeys.has(dataKey));
    return { ...entry, inactive: isHidden };
  });
}

/**
 * Compose custom legend content the same way Recharts does:
 * clone elements, create function content as a React component, or fall back to
 * default content. The fallback is Phoenix-specific only because it renders
 * toggle buttons.
 */
function renderBaseLegendContent({
  baseContent,
  contentProps,
}: {
  baseContent: LegendProps["content"];
  contentProps: RechartsLegendContentProps;
}) {
  if (isValidElement<RechartsLegendContentProps>(baseContent)) {
    return cloneElement(baseContent, contentProps);
  }

  if (typeof baseContent === "function") {
    return createElement(baseContent, contentProps);
  }

  return <DefaultInteractiveLegendContent {...contentProps} />;
}

/**
 * Phoenix's button-based equivalent of Recharts' DefaultLegendContent.
 *
 * This remains local instead of importing DefaultLegendContent because Recharts
 * renders each legend item as an inert `<li>`, while Phoenix needs each
 * toggleable item to be a real `<button>` for keyboard and screen-reader
 * support.
 */
function DefaultInteractiveLegendContent({
  align = "center",
  formatter,
  iconSize = 14,
  iconType,
  inactiveColor = "var(--global-color-gray-500)",
  labelStyle,
  layout = "horizontal",
  onClick,
  onMouseEnter,
  onMouseLeave,
  payload,
}: RechartsLegendContentProps) {
  if (payload == null || payload.length === 0) {
    return null;
  }

  return (
    <ul
      css={[
        legendCSS,
        layout === "vertical" && verticalLegendCSS,
        getLegendAlignmentCSS(align),
      ]}
      className="recharts-default-legend"
    >
      {payload.map((entry, index) => {
        if (entry.type === "none") {
          return null;
        }

        const dataKey = getInteractiveDataKey(entry.dataKey);
        const isHidden = entry.inactive === true;
        const finalFormatter = entry.formatter ?? formatter;
        const label = getLegendItemText(entry);
        const renderedLabel =
          finalFormatter == null
            ? label
            : finalFormatter(entry.value, entry, index);
        const mergedLabelStyle = {
          ...(typeof labelStyle === "object" ? labelStyle : {}),
        };
        mergedLabelStyle.color = isHidden
          ? inactiveColor
          : (mergedLabelStyle.color ?? entry.color);
        const itemClassName = `recharts-legend-item legend-item-${index}${isHidden ? " inactive" : ""}`;

        return (
          <li
            className={itemClassName}
            css={legendItemCSS}
            key={`${label}-${index}`}
          >
            {dataKey == null ? (
              <span
                css={legendStaticItemCSS}
                onMouseEnter={(event) => {
                  onMouseEnter?.(entry, index, event);
                }}
                onMouseLeave={(event) => {
                  onMouseLeave?.(entry, index, event);
                }}
                style={mergedLabelStyle}
              >
                <LegendIcon
                  entry={entry}
                  iconSize={iconSize}
                  iconType={iconType}
                  inactiveColor={inactiveColor}
                />
                <span className="recharts-legend-item-text">
                  {renderedLabel}
                </span>
              </span>
            ) : (
              <button
                aria-label={getLegendItemAriaLabel({
                  isHidden,
                  label,
                })}
                aria-pressed={!isHidden}
                css={legendButtonCSS}
                data-inactive={isHidden ? true : undefined}
                onClick={(event) => {
                  onClick?.(entry, index, event);
                }}
                onMouseEnter={(event) => {
                  onMouseEnter?.(entry, index, event);
                }}
                onMouseLeave={(event) => {
                  onMouseLeave?.(entry, index, event);
                }}
                style={mergedLabelStyle}
                title={label}
                type="button"
              >
                <LegendIcon
                  entry={entry}
                  iconSize={iconSize}
                  iconType={iconType}
                  inactiveColor={inactiveColor}
                />
                <span className="recharts-legend-item-text">
                  {renderedLabel}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Internal content adapter injected into Recharts' `Legend`.
 *
 * Recharts calls this with its fully prepared legend props after applying
 * wrapper layout, payload sorting, and payload de-duplication. The adapter then
 * enhances `payload` and wraps `onClick` so custom content can prevent the
 * toggle by calling `event.preventDefault()`.
 */
function InteractiveLegendContent({
  baseContent,
  content: _internalContent,
  hiddenDataKeys,
  onClick,
  onToggleDataKey,
  payload,
  additionalLegendItems,
  ...contentProps
}: InteractiveLegendContentProps) {
  const enhancedPayload = getEnhancedPayload({
    hiddenDataKeys,
    payload: [...(payload ?? []), ...(additionalLegendItems ?? [])],
  });
  const onLegendItemClick = (
    entry: LegendPayload,
    index: number,
    event: MouseEvent<HTMLElement>
  ) => {
    onClick?.(entry, index, event);
    const dataKey = getInteractiveDataKey(entry.dataKey);
    if (dataKey != null && !event.defaultPrevented) {
      onToggleDataKey(dataKey);
    }
  };

  return renderBaseLegendContent({
    baseContent,
    contentProps: {
      ...contentProps,
      content: baseContent,
      onClick: onLegendItemClick,
      payload: enhancedPayload,
    },
  });
}

/**
 * Shared hidden-series state for charts using InteractiveLegend.
 */
export function useInteractiveLegend({
  defaultHiddenDataKeys = [],
}: UseInteractiveLegendProps = {}) {
  const [hiddenDataKeys, setHiddenDataKeys] = useState<
    ReadonlySet<InteractiveLegendDataKey>
  >(() => new Set(defaultHiddenDataKeys));

  const isDataKeyHidden = (
    dataKey: InteractiveLegendDataKey | null | undefined
  ) => dataKey != null && hiddenDataKeys.has(dataKey);

  const toggleDataKey = (dataKey: InteractiveLegendDataKey) => {
    setHiddenDataKeys((currentHiddenDataKeys) => {
      const nextHiddenDataKeys = new Set(currentHiddenDataKeys);
      if (nextHiddenDataKeys.has(dataKey)) {
        nextHiddenDataKeys.delete(dataKey);
      } else {
        nextHiddenDataKeys.add(dataKey);
      }
      return nextHiddenDataKeys;
    });
  };

  return { hiddenDataKeys, isDataKeyHidden, toggleDataKey };
}

/**
 * Recharts Legend with Phoenix interactive hide/show behavior.
 *
 * Pass the returned state from `useInteractiveLegend` into this component and
 * wire `isDataKeyHidden(dataKey)` to each chart item's `hide` prop.
 */
export function InteractiveLegend({
  content,
  hiddenDataKeys,
  onToggleDataKey,
  additionalLegendItems,
  ...legendProps
}: InteractiveLegendProps) {
  return (
    <Legend
      {...legendProps}
      content={
        <InteractiveLegendContent
          baseContent={content}
          hiddenDataKeys={hiddenDataKeys}
          onToggleDataKey={onToggleDataKey}
          additionalLegendItems={additionalLegendItems}
        />
      }
    />
  );
}
