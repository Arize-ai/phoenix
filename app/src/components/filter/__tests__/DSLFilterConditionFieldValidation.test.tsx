import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DSLFilterConditionField } from "../DSLFilterConditionField";

vi.mock("@uiw/react-codemirror", () => ({
  default: () => null,
  EditorView: {
    contentAttributes: { of: vi.fn(() => ({})) },
    updateListener: { of: vi.fn(() => ({})) },
  },
  keymap: { of: vi.fn(() => ({})) },
}));

vi.mock("@phoenix/contexts", () => ({
  useTheme: () => ({ theme: "light" }),
}));

describe("DSLFilterConditionField validation outcomes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("distinguishes an invalid expression from a transport failure", async () => {
    const onValidationFailed = vi.fn();
    const validateCondition = vi
      .fn()
      .mockResolvedValueOnce({ isValid: false, errorMessage: "malformed" })
      .mockRejectedValueOnce(new Error("network failed"));

    await renderField({
      root,
      value: "condition-invalid",
      validateCondition,
      onValidationFailed,
      validationRetryKey: 0,
    });
    expect(onValidationFailed).toHaveBeenLastCalledWith("invalid");

    await renderField({
      root,
      value: "condition-transport",
      validateCondition,
      onValidationFailed,
      validationRetryKey: 0,
    });
    expect(onValidationFailed).toHaveBeenLastCalledWith("transport");
  });

  it("revalidates unchanged text when the retry key advances", async () => {
    const onValidationFailed = vi.fn();
    const validateCondition = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce({ isValid: true });

    await renderField({
      root,
      value: "condition-retry",
      validateCondition,
      onValidationFailed,
      validationRetryKey: 0,
    });
    expect(validateCondition).toHaveBeenCalledTimes(1);
    expect(onValidationFailed).toHaveBeenCalledWith("transport");

    await renderField({
      root,
      value: "condition-retry",
      validateCondition,
      onValidationFailed,
      validationRetryKey: 1,
    });
    expect(validateCondition).toHaveBeenCalledTimes(2);
  });

  it("marks only the mount-time settlement as initial", async () => {
    const onValidCondition = vi.fn();
    const onValidationFailed = vi.fn();
    const validateCondition = vi.fn().mockResolvedValue({ isValid: true });

    // The mount value arrives from a URL or a caller's default, not from the
    // user -- consumers use the flag to avoid persisting it anywhere.
    await renderField({
      root,
      value: "condition-seeded",
      validateCondition,
      onValidCondition,
      onValidationFailed,
      validationRetryKey: 0,
    });
    expect(onValidCondition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        condition: "condition-seeded",
        isInitialSettlement: true,
      })
    );

    await renderField({
      root,
      value: "condition-typed",
      validateCondition,
      onValidCondition,
      onValidationFailed,
      validationRetryKey: 0,
    });
    expect(onValidCondition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        condition: "condition-typed",
        isInitialSettlement: false,
      })
    );
  });

  it("surfaces an advisory warning without flagging the field invalid", async () => {
    const onValidCondition = vi.fn();
    const validateCondition = vi.fn().mockResolvedValue({
      isValid: true,
      warnings: [
        {
          message: "`kind` is not a known span field.",
          identifier: "kind",
          suggestion: "span_kind",
        },
      ],
    });

    await renderField({
      root,
      value: "kind == 'AGENT'",
      validateCondition,
      onValidCondition,
      onValidationFailed: vi.fn(),
      validationRetryKey: 0,
    });

    // A warning is a nudge, not a failure: the amber badge shows, the red
    // error badge does not, and the field is never marked invalid.
    expect(container.querySelector(".warning-badge")).not.toBeNull();
    expect(container.querySelector(".error-badge")).toBeNull();
    expect(container.textContent).toContain("Did you mean span_kind?");
    // The warnings still ride along to consumers (empty state, history).
    expect(onValidCondition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        condition: "kind == 'AGENT'",
        validationResult: expect.objectContaining({
          warnings: [
            {
              message: "`kind` is not a known span field.",
              identifier: "kind",
              suggestion: "span_kind",
            },
          ],
        }),
      })
    );
  });
});

async function renderField({
  root,
  value,
  validateCondition,
  onValidCondition = () => undefined,
  onValidationFailed,
  validationRetryKey,
}: {
  root: Root;
  value: string;
  validateCondition: (condition: string) => Promise<{
    isValid: boolean;
    errorMessage?: string;
    warnings?: {
      message: string;
      identifier?: string;
      suggestion?: string | null;
    }[];
  }>;
  onValidCondition?: (args: {
    condition: string;
    validationResult?: {
      isValid: boolean;
      warnings?: {
        message: string;
        identifier?: string;
        suggestion?: string | null;
      }[];
    } | null;
    isInitialSettlement: boolean;
  }) => void;
  onValidationFailed: (reason: "invalid" | "transport") => void;
  validationRetryKey: number;
}) {
  await act(async () => {
    root.render(
      <DSLFilterConditionField
        value={value}
        onChange={() => undefined}
        completions={[]}
        validateCondition={validateCondition}
        onValidCondition={onValidCondition}
        onValidationFailed={onValidationFailed}
        validationRetryKey={validationRetryKey}
      />
    );
  });
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}
