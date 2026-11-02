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

function TestCredentialForm({
  defaultApiKey,
  onSubmit,
}: {
  defaultApiKey: string;
  onSubmit: (values: { apiKey: string }) => void;
}) {
  const { control, handleSubmit } = useForm<{ apiKey: string }>({
    defaultValues: { apiKey: defaultApiKey },
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

  it("submits untouched redacted token when required inside a Form", async () => {
    const onSubmit = vi.fn();
    act(() => {
      root.render(
        <TestCredentialForm
          defaultApiKey={REDACTED_TOKEN}
          onSubmit={onSubmit}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>("input");
    const submitButton = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );
    expect(input).not.toBeNull();
    expect(input?.value).toBe("");
    expect(input?.placeholder).toBe("••••xyz9");
    expect(input?.required).toBe(false);
    expect(input?.getAttribute("aria-required")).toBe("true");

    const user = userEvent.setup();
    await act(async () => user.click(submitButton!));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ apiKey: REDACTED_TOKEN });
  });

  it("blocks submit and shows required error when value is cleared", async () => {
    const onSubmit = vi.fn();
    act(() => {
      root.render(
        <TestCredentialForm
          defaultApiKey={REDACTED_TOKEN}
          onSubmit={onSubmit}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>("input");
    const submitButton = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );
    const user = userEvent.setup();

    await act(async () => user.type(input!, "new-key"));
    expect(input?.value).toBe("new-key");

    await act(async () => user.clear(input!));
    expect(input?.value).toBe("");
    expect(input?.placeholder).toBe("sk-...");

    await act(async () => user.click(submitButton!));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("API Key is required");
  });
});
