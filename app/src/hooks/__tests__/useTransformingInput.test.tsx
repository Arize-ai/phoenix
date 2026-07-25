import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transformEnvironmentVariableInput } from "@phoenix/utils/environmentVariableUtils";
import { transformIdentifierInput } from "@phoenix/utils/identifierUtils";
import { transformURISafeInput } from "@phoenix/utils/uriUtils";

import { useTransformingInput } from "../useTransformingInput";

function setNativeInputValue({
  input,
  value,
  selectionStart = value.length,
  selectionEnd = selectionStart,
}: {
  input: HTMLInputElement;
  value: string;
  selectionStart?: number;
  selectionEnd?: number;
}) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setValue?.call(input, value);
  input.setSelectionRange(selectionStart, selectionEnd);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function TransformingInputHarness({
  initialValue,
  onValueCommitted,
  transformValue,
  shouldWireInputProps = true,
}: {
  initialValue: string;
  onValueCommitted: (value: string) => void;
  transformValue: (value: string) => string;
  shouldWireInputProps?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const transformingInput = useTransformingInput({
    value,
    onValueChange: (nextValue) => {
      onValueCommitted(nextValue);
      setValue(nextValue);
    },
    transformValue,
  });
  return (
    <input
      {...(shouldWireInputProps ? transformingInput.inputProps : {})}
      value={transformingInput.displayValue}
      onChange={(event) =>
        transformingInput.handleValueChange(event.currentTarget.value)
      }
    />
  );
}

describe("useTransformingInput", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scheduledFrames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  const flushAnimationFrames = () => {
    const frames = [...scheduledFrames.values()];
    scheduledFrames.clear();
    act(() => frames.forEach((callback) => callback(0)));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    scheduledFrames = new Map();
    nextFrameId = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId++;
      scheduledFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      scheduledFrames.delete(frameId);
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const renderHarness = ({
    initialValue,
    onValueCommitted = vi.fn(),
    transformValue = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    shouldWireInputProps = true,
  }: {
    initialValue: string;
    onValueCommitted?: (value: string) => void;
    transformValue?: (value: string) => string;
    shouldWireInputProps?: boolean;
  }) => {
    act(() => {
      root.render(
        <TransformingInputHarness
          initialValue={initialValue}
          onValueCommitted={onValueCommitted}
          transformValue={transformValue}
          shouldWireInputProps={shouldWireInputProps}
        />
      );
    });
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    act(() => input?.focus());
    return input as HTMLInputElement;
  };

  it("preserves the caret after a transform in the middle of the value", () => {
    const input = renderHarness({ initialValue: "alphabet" });

    act(() => {
      setNativeInputValue({
        input,
        value: "alpha bet",
        selectionStart: 6,
      });
    });
    flushAnimationFrames();

    expect(input.value).toBe("alpha-bet");
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
  });

  it("restores the caret when a dropped character leaves the value unchanged", () => {
    const input = renderHarness({ initialValue: "alpha-beta" });

    act(() => {
      setNativeInputValue({
        input,
        value: "alpha!-beta",
        selectionStart: 6,
      });
    });
    flushAnimationFrames();

    expect(input.value).toBe("alpha-beta");
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
  });

  it.each([
    {
      name: "identifier",
      transformValue: transformIdentifierInput,
      rawValue: "Alpha Beta",
      selectionStart: 6,
      expectedValue: "alpha-beta",
      expectedSelectionStart: 6,
    },
    {
      name: "environment variable",
      transformValue: transformEnvironmentVariableInput,
      rawValue: "API KEY",
      selectionStart: 4,
      expectedValue: "API_KEY",
      expectedSelectionStart: 4,
    },
    {
      name: "URI-safe",
      transformValue: transformURISafeInput,
      rawValue: "My Project",
      selectionStart: 3,
      expectedValue: "My-Project",
      expectedSelectionStart: 3,
    },
  ])(
    "maps the caret through the production $name transform",
    ({
      transformValue,
      rawValue,
      selectionStart,
      expectedValue,
      expectedSelectionStart,
    }) => {
      const input = renderHarness({ initialValue: "", transformValue });

      act(() => {
        setNativeInputValue({ input, value: rawValue, selectionStart });
      });
      flushAnimationFrames();

      expect(input.value).toBe(expectedValue);
      expect(input.selectionStart).toBe(expectedSelectionStart);
      expect(input.selectionEnd).toBe(expectedSelectionStart);
    }
  );

  it("maps a selection through expanding and collapsing transforms", () => {
    const input = renderHarness({
      initialValue: "a& bc",
      transformValue: (value) =>
        value.replaceAll("&", "and").replace(/ +/g, "-"),
    });

    act(() => {
      setNativeInputValue({
        input,
        value: "a&  bc",
        selectionStart: 2,
        selectionEnd: 4,
      });
    });
    flushAnimationFrames();

    expect(input.value).toBe("aand-bc");
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(5);
  });

  it("preserves the caret after pasting over a middle selection", async () => {
    const input = renderHarness({ initialValue: "alpha-beta-gamma" });
    input.setSelectionRange(6, 10);

    const user = userEvent.setup();
    await act(async () => user.paste("New Value"));
    flushAnimationFrames();

    expect(input.value).toBe("alpha-new-value-gamma");
    expect(input.selectionStart).toBe(15);
    expect(input.selectionEnd).toBe(15);
  });

  it("keeps composition text raw and commits it when composition ends", () => {
    const onValueCommitted = vi.fn();
    const input = renderHarness({
      initialValue: "alpha",
      onValueCommitted,
    });

    act(() => {
      input.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      setNativeInputValue({ input, value: "Alpha Z" });
    });

    expect(input.value).toBe("Alpha Z");
    expect(onValueCommitted).not.toHaveBeenCalled();

    act(() => {
      input.dispatchEvent(new Event("compositionend", { bubbles: true }));
    });
    flushAnimationFrames();

    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenCalledWith("alpha-z");
    expect(input.value).toBe("alpha-z");
  });

  it("cancels a stale selection restoration when another edit occurs", () => {
    const input = renderHarness({ initialValue: "alphabet" });

    act(() => {
      setNativeInputValue({
        input,
        value: "alpha bet",
        selectionStart: 6,
      });
      setNativeInputValue({
        input,
        value: "alpha b et",
        selectionStart: 8,
      });
    });

    expect(scheduledFrames.size).toBe(1);
    flushAnimationFrames();
    expect(input.selectionStart).toBe(8);
  });

  it("warns once when inputProps are not wired to the native input", () => {
    const consoleWarning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const input = renderHarness({
      initialValue: "alpha",
      shouldWireInputProps: false,
    });

    act(() => {
      setNativeInputValue({ input, value: "Alpha" });
      setNativeInputValue({ input, value: "Alpha Beta" });
    });

    expect(consoleWarning).toHaveBeenCalledTimes(1);
    expect(consoleWarning).toHaveBeenCalledWith(
      "useTransformingInput could not access the native input. Spread the returned inputProps onto the Input element to preserve selection and IME composition."
    );
  });
});
