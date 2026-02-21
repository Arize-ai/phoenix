import { css } from "@emotion/react";
import React, { forwardRef, useContext } from "react";
import {
  Input,
  Label,
  LabelContext,
  Slider as AriaSlider,
  SliderOutput as AriaSliderOutput,
  type SliderProps as AriaSliderProps,
  SliderStateContext,
  SliderThumb as AriaSliderThumb,
  SliderTrack as AriaSliderTrack,
  useSlottedContext,
} from "react-aria-components";

import { Text } from "../content";
import type { NumberFieldProps } from "../field/NumberField";
import { NumberField } from "../field/NumberField";
import type { StylableProps } from "../types";

const sliderCSS = css`
  --slider-handle-width: var(--global-dimension-size-250);
  --slider-handle-height: var(--global-dimension-size-250);
  --slider-handle-halo-width: var(--global-dimension-size-350);
  --slider-handle-border-radius: var(--global-dimension-size-250);
  --slider-handle-background-color: white;
  --slider-track-height: var(--global-dimension-size-100);
  --slider-filled-color: var(--global-color-primary);

  display: grid;
  grid-template-areas:
    "label output"
    "track track";
  gap: var(--global-dimension-size-100);
  grid-template-columns: 1fr auto;
  width: var(--alias-single-line-width, var(--global-dimension-size-2400));
  color: var(--text-color);

  .ac-slider-label {
    grid-area: label;
  }

  .ac-slider-output {
    grid-area: output;
    min-height: var(--global-dimension-size-350);
  }

  .ac-slider-track {
    grid-area: track;
    position: relative;
    height: var(--slider-track-height, var(--global-border-size-thick));
    width: 100%;

    /* Background track line */
    &:before {
      content: "";
      display: block;
      position: absolute;
      background: var(--global-color-gray-300);
      height: 100%;
      border-radius: var(--global-border-size-thicker);
    }

    /* Filled track line */
    &:after {
      content: "";
      display: block;
      position: absolute;
      background: var(--slider-filled-color);
      height: 100%;
      border-radius: var(--global-border-size-thicker);
    }
  }

  .ac-slider-thumb {
    width: var(--slider-handle-width, var(--global-dimension-size-200));
    height: var(--slider-handle-height, var(--global-dimension-size-200));
    border-radius: var(
      --slider-handle-border-radius,
      var(--global-rounding-medium)
    );
    background-color: var(--slider-handle-background-color);
    border: 2px solid var(--background-color);
    box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.25);
    forced-color-adjust: none;
    transition: border-width
      var(--slider-animation-duration, var(--global-animation-duration-100))
      ease-in-out;
    position: relative;

    /* show a halo when hovering over the thumb */
    &:hover::after {
      content: "";
      position: absolute;
      background: white;
      opacity: 0.5;
      display: block;
      width: var(--slider-handle-halo-width);
      height: var(--slider-handle-halo-width);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: var(
        --slider-handle-border-radius,
        var(--global-rounding-medium)
      );
      z-index: -1;
    }

    &[data-dragging] {
      background: white;
    }

    &[data-focus-visible] {
      outline: 2px solid var(--focus-ring-color);
    }
  }

  &[data-orientation="horizontal"] {
    flex-direction: column;
    width: 100%;
    align-items: baseline;

    .ac-slider-number-field {
      .react-aria-Input {
        min-width: var(--global-dimension-size-800);
        width: var(--global-dimension-size-800);
        padding: 0 var(--global-dimension-size-100);
        height: var(--global-dimension-size-350);
        text-align: right;
        margin-bottom: var(--global-dimension-size-100);
      }
    }

    .ac-slider-track {
      height: var(--slider-track-height, var(--global-border-size-thick));
      width: calc(100% - var(--slider-handle-width));
      left: calc(var(--slider-handle-width) / 2);

      /* background track line */
      &:before {
        left: calc(var(--slider-handle-width) / -2);
        width: calc(100% + var(--slider-handle-width));
        top: 50%;
        transform: translateY(-50%);
      }

      /* filled track line */
      &:after {
        left: calc(var(--slider-start) - var(--slider-handle-width) / 2);
        width: calc(
          var(--slider-end) - var(--slider-start) + var(--slider-handle-width)
        );
        top: 50%;
        transform: translateY(-50%);
        z-index: 1;
      }
    }

    .ac-slider-thumb {
      top: 50%;
      z-index: 2;
    }
  }
`;

export type SliderProps<T> = AriaSliderProps<T> &
  StylableProps &
  React.PropsWithChildren<{
    label?: string;
    thumbLabels?: string[];
  }>;

function _Slider<T extends number | number[]>(
  { label, thumbLabels, children, css: _css, ...props }: SliderProps<T>,
  ref: React.Ref<HTMLDivElement>
) {
  return (
    <AriaSlider css={css(sliderCSS, _css)} {...props} ref={ref}>
      {label && <Label className="ac-slider-label">{label}</Label>}
      <AriaSliderOutput className="ac-slider-output">
        {typeof children === "undefined" ? <SliderTextField /> : children}
      </AriaSliderOutput>
      <AriaSliderTrack
        className="ac-slider-track"
        style={({ state }) => {
          // check state to determine how we should fill the track
          // generate css vars for single thumb
          if (state.values.length === 1) {
            return {
              "--slider-start": "0%",
              "--slider-end": `${state.getThumbPercent(0) * 100}%`,
            } as React.CSSProperties;
          }

          // generate css vars for multi-thumb
          return {
            "--slider-start": `${state.getThumbPercent(0) * 100}%`,
            "--slider-end": `${state.getThumbPercent(1) * 100}%`,
          } as React.CSSProperties;
        }}
      >
        {({ state }) => (
          <>
            {state.values.map((_, i) => (
              <AriaSliderThumb
                key={i}
                index={i}
                aria-label={thumbLabels?.[i]}
                className="ac-slider-thumb"
              />
            ))}
          </>
        )}
      </AriaSliderTrack>
    </AriaSlider>
  );
}

export const Slider = forwardRef(_Slider) as <T extends number | number[]>(
  props: SliderProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => ReturnType<typeof _Slider>;

export const SliderNumberField = ({
  onChange: _onChange,
  ...props
}: NumberFieldProps) => {
  const sliderState = useContext(SliderStateContext)!;
  const { step, getThumbMinValue, getThumbMaxValue, values, setThumbValue } =
    sliderState;

  // In the case that the defaultValue is set (e.x. undefined)
  // The slider will show the min value. However this is not what we want to inherit
  const isDefaultValueSet = "defaultValue" in props;
  const firstValueIsMin = values[0] === getThumbMinValue(0);
  const useDefaultValue = isDefaultValueSet && firstValueIsMin;

  const value = useDefaultValue ? props.defaultValue : values[0];
  const labelProps = useSlottedContext(LabelContext)!;
  return (
    <NumberField
      className="ac-slider-number-field"
      aria-labelledby={labelProps.id}
      value={value}
      onChange={(v) => {
        if (_onChange) {
          _onChange(v);
        } else if (typeof v === "number") {
          setThumbValue(0, v);
        }
      }}
      step={step}
      maxValue={getThumbMaxValue(0)}
      minValue={getThumbMinValue(0)}
      {...props}
    >
      <Input />
    </NumberField>
  );
};

function SliderTextField() {
  const state = useContext(SliderStateContext)!;
  return <Text>{state.values.map((v) => v.toString()).join(" – ")}</Text>;
}
