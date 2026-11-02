import { act } from "react";
import { Form } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { Controller, useForm } from "react-hook-form";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@phoenix/components/core/button";

import { RedactedCredentialField } from "../RedactedCredentialField";

const REDACTED_TOKEN = "\ue000REDACTED\ue000xyz9\ue000gAAAAABtoken";
const NEXT_REDACTED_TOKEN = "\ue000REDACTED\ue0001234\ue000gAAAAABnext";

function TestCredentialForm({
  apiKey = REDACTED_TOKEN,
  onSubmit,
}: {
  apiKey?: string;
  onSubmit: (values: { apiKey: string }) => void;
}) {
  const { control, handleSubmit } = useForm<{ apiKey: string }>({
    defaultValues: { apiKey },
    values: { apiKey },
    mode: "onChange",
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="apiKey"
        control={control}
        rules={{ required: "API Key is required" }}
        render={({
          field: { name, value, onChange, onBlur },
          fieldState: { error },
        }) => (
          <RedactedCredentialField
            label="API Key"
            placeholder="sk-..."
            isRequired
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            errorMessage={error?.message}
          />
        )}
      />
      <Button type="submit">Update Provider</Button>
    </Form>
  );
}

describe("RedactedCredentialField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("round-trips redacted tokens, validates edits, and re-masks on value sync", async () => {
    const onSubmit = vi.fn();
    act(() => {
      root.render(<TestCredentialForm onSubmit={onSubmit} />);
    });

    const input = container.querySelector<HTMLInputElement>("input")!;
    const submitButton = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    )!;
    const user = userEvent.setup();

    // 1. Untouched redacted token displays as masked placeholder and submits cleanly
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("••••xyz9");
    await act(async () => user.click(submitButton));
    expect(onSubmit).toHaveBeenLastCalledWith(
      { apiKey: REDACTED_TOKEN },
      expect.anything()
    );

    // 2. Typing replaces the token; clearing blocks submit with required error
    onSubmit.mockClear();
    await act(async () => user.type(input, "sk-new"));
    await act(async () => user.clear(input));
    expect(input.placeholder).toBe("sk-...");
    await act(async () => user.click(submitButton));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("API Key is required");

    // 3. Entering a new key submits the plaintext replacement
    await act(async () => user.type(input, "sk-replacement"));
    await act(async () => user.click(submitButton));
    expect(onSubmit).toHaveBeenLastCalledWith(
      { apiKey: "sk-replacement" },
      expect.anything()
    );

    // 4. Syncing a new redacted token re-masks the input instead of leaking the token into value
    act(() => {
      root.render(
        <TestCredentialForm apiKey={NEXT_REDACTED_TOKEN} onSubmit={onSubmit} />
      );
    });
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("••••1234");
  });
});
