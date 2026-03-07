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
  --slider-thumb-size: var(--global-dimension-static-size-200);
  --slider-thumb-bg: white;
  --slider-thumb-border-color: var(--global-color-gray-400);
  --slider-track-height: var(--global-dimension-static-size-50);
  --slider-track-bg: var(--global-color-gray-300);
  --slider-filled-color: var(--global-color-primary);
  --slider-ring-color: var(--global-color-primary-200);

  display: grid;
  grid-template-areas:
    "label output"
    "track track";
  gap: var(--global-dimension-size-100);
  grid-template-columns: 1fr auto;
  width: var(--alias-single-line-width, var(--global-dimension-size-2400));
  color: var(--text-color);

  .slider__label {
    grid-area: label;
  }

  .slider__output {
    grid-area: output;
    min-height: var(--global-dimension-size-350);
  }

  .slider__track {
    grid-area: track;
    position: relative;
    height: var(--slider-track-height);
    width: 100%;

    /* Background track line */
    &:before {
      content: "";
      display: block;
      position: absolute;
      background: var(--slider-track-bg);
      height: 100%;
      border-radius: var(--global-rounding-full);
    }

    /* Filled track line */
    &:after {
      content: "";
      display: block;
      position: absolute;
      background: var(--slider-filled-color);
      height: 100%;
      border-radius: var(--global-rounding-full);
    }
  }

  .slider__thumb {
    width: var(--slider-thumb-size);
    height: var(--slider-thumb-size);
    border-radius: 50%;
    background: var(--slider-thumb-bg);
    border: 2px solid var(--slider-thumb-border-color);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1);
    forced-color-adjust: none;
    transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;

    &:hover,
    &[data-focus-visible],
    &[data-dragging] {
      box-shadow: 0 0 0 4px var(--slider-ring-color);
    }

    &[data-focus-visible] {
      outline: none;
    }
  }

  &[data-orientation="horizontal"] {
    flex-direction: column;
    width: 100%;
    align-items: baseline;

    .slider__number-field {
      .react-aria-Input {
        min-width: var(--global-dimension-size-800);
        width: var(--global-dimension-size-800);
        padding: 0 var(--global-dimension-size-100);
        height: var(--global-dimension-size-350);
        text-align: right;
        margin-bottom: var(--global-dimension-size-100);
      }
    }

    .slider__track {
      height: var(--slider-track-height);
      width: calc(100% - var(--slider-thumb-size));
      left: calc(var(--slider-thumb-size) / 2);

      /* background track line */
      &:before {
        left: calc(var(--slider-thumb-size) / -2);
        width: calc(100% + var(--slider-thumb-size));
        top: 50%;
        transform: translateY(-50%);
      }

      /* filled track line */
      &:after {
        left: calc(var(--slider-start) - var(--slider-thumb-size) / 2);
        width: calc(
          var(--slider-end) - var(--slider-start) + var(--slider-thumb-size)
        );
        top: 50%;
        transform: translateY(-50%);
        z-index: 1;
      }
    }

    .slider__thumb {
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
      {label && <Label className="slider__label">{label}</Label>}
      <AriaSliderOutput className="slider__output">
        {typeof children === "undefined" ? <SliderTextField /> : children}
      </AriaSliderOutput>
      <AriaSliderTrack
        className="slider__track"
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
                className="slider__thumb"
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

export function SliderNumberField({
  onChange: _onChange,
  ...props
}: NumberFieldProps) {
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
      className="slider__number-field"
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
}

function SliderTextField() {
  const state = useContext(SliderStateContext)!;
  return <Text>{state.values.map((v) => v.toString()).join(" – ")}</Text>;
}
