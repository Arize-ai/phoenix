import {
  useRef,
  useState,
  type CompositionEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";

type SelectionDirection = "backward" | "forward" | "none";

type TextSelection = {
  start: number;
  end: number;
  direction?: SelectionDirection;
};

type ScheduledSelection = TextSelection & {
  value: string;
};

export type TransformingInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "onCompositionStart" | "onCompositionEnd"
> & {
  ref: RefObject<HTMLInputElement | null>;
};

export type UseTransformingInputOptions = {
  value: string;
  onValueChange: (value: string) => void;
  transformValue: (value: string) => string;
};

/**
 * Applies a live text transform without disrupting the user's selection or an
 * in-progress input-method-editor (IME) composition.
 *
 * Selection mapping assumes the transform is prefix-stable: transforming a
 * prefix must produce the same prefix as transforming the complete value. The
 * identifier, environment-variable, and URI-safe transforms satisfy this.
 *
 * @param params - Controlled input configuration.
 * @param params.value - The committed controlled value.
 * @param params.onValueChange - Receives transformed, committed values.
 * @param params.transformValue - Pure function that transforms input text.
 */
export function useTransformingInput({
  value,
  onValueChange,
  transformValue,
}: UseTransformingInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const scheduledAnimationFrameRef = useRef<number | null>(null);
  const [compositionValue, setCompositionValue] = useState<string | null>(null);

  const cancelScheduledSelection = () => {
    if (scheduledAnimationFrameRef.current == null) {
      return;
    }
    cancelAnimationFrame(scheduledAnimationFrameRef.current);
    scheduledAnimationFrameRef.current = null;
  };

  const scheduleSelection = ({
    value: expectedValue,
    start,
    end,
    direction,
  }: ScheduledSelection) => {
    cancelScheduledSelection();
    scheduledAnimationFrameRef.current = requestAnimationFrame(() => {
      scheduledAnimationFrameRef.current = null;
      const input = inputRef.current;
      const canRestoreSelection =
        input != null &&
        document.activeElement === input &&
        input.value === expectedValue;
      if (canRestoreSelection) {
        input.setSelectionRange(start, end, direction);
      }
    });
  };

  const getCurrentSelection = (rawValue: string): TextSelection => {
    const input = inputRef.current;
    return {
      start: input?.selectionStart ?? rawValue.length,
      end: input?.selectionEnd ?? rawValue.length,
      direction: input?.selectionDirection ?? undefined,
    };
  };

  const commitValue = ({
    rawValue,
    selection,
  }: {
    rawValue: string;
    selection: TextSelection;
  }) => {
    const transformedValue = transformValue(rawValue);
    const transformedSelection = {
      start: transformValue(rawValue.slice(0, selection.start)).length,
      end: transformValue(rawValue.slice(0, selection.end)).length,
      direction: selection.direction,
    };

    onValueChange(transformedValue);

    if (transformedValue !== rawValue) {
      scheduleSelection({
        value: transformedValue,
        ...transformedSelection,
      });
    }
  };

  const handleValueChange = (rawValue: string) => {
    cancelScheduledSelection();
    if (isComposingRef.current) {
      setCompositionValue(rawValue);
      return;
    }
    commitValue({
      rawValue,
      selection: getCurrentSelection(rawValue),
    });
  };

  const handleCompositionStart = (
    event: CompositionEvent<HTMLInputElement>
  ) => {
    cancelScheduledSelection();
    isComposingRef.current = true;
    setCompositionValue(event.currentTarget.value);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    const selection = getCurrentSelection(rawValue);
    isComposingRef.current = false;
    setCompositionValue(null);
    commitValue({ rawValue, selection });
  };

  const inputProps: TransformingInputProps = {
    ref: inputRef,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };

  return {
    displayValue: compositionValue ?? value,
    handleValueChange,
    inputProps,
  };
}

export type TransformingInputControllerState = ReturnType<
  typeof useTransformingInput
>;

/**
 * Headless adapter for using {@link useTransformingInput} where a form library
 * supplies the controlled value inside a render callback.
 */
export function TransformingInputController({
  children,
  ...options
}: UseTransformingInputOptions & {
  children: (state: TransformingInputControllerState) => ReactNode;
}) {
  return children(useTransformingInput(options));
}
