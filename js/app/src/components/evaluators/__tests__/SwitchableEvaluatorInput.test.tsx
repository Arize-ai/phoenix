import { act, useState } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { useForm } from "react-hook-form";
import { userEvent } from "storybook/test";

import {
  hasMappingValue,
  resolveMappingMode,
  SwitchableEvaluatorInput,
} from "../SwitchableEvaluatorInput";

type MappingForm = {
  pathMapping: Record<string, string>;
  literalMapping: Record<string, string | number | boolean>;
};

function Harness({ defaultValues }: { defaultValues: Partial<MappingForm> }) {
  const form = useForm<MappingForm>({
    defaultValues: {
      pathMapping: {},
      literalMapping: {},
      ...defaultValues,
    },
    mode: "onChange",
  });
  const [isPresent, setIsPresent] = useState(true);
  return (
    <>
      {isPresent && (
        <SwitchableEvaluatorInput
          fieldName="somevar"
          label="somevar"
          control={form.control}
          getValues={form.getValues}
          setValue={form.setValue}
          pathOptions={[{ id: "input.question", label: "input.question" }]}
        />
      )}
      <button
        type="button"
        data-testid="toggle"
        onClick={() => setIsPresent((present) => !present)}
      >
        toggle
      </button>
    </>
  );
}

describe("SwitchableEvaluatorInput", () => {
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

  const modeTrigger = () =>
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Select input mode for somevar"]'
    );
  const literalInput = () =>
    container.querySelector<HTMLInputElement>("#somevar-literal");
  const pathInput = () =>
    container.querySelector<HTMLInputElement>("#somevar-path");
  const toggle = () =>
    container.querySelector<HTMLButtonElement>('[data-testid="toggle"]');

  const render = (defaultValues: Partial<MappingForm> = {}) => {
    act(() => {
      root.render(<Harness defaultValues={defaultValues} />);
    });
  };

  const chooseMode = async (optionName: string) => {
    const user = userEvent.setup();
    await act(async () => user.click(modeTrigger() as HTMLButtonElement));
    const option = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((item) => item.textContent === optionName);
    expect(option).toBeDefined();
    await act(async () => user.click(option as HTMLElement));
  };

  it("recovers the mode of a variable that was erased and retyped", async () => {
    render();
    expect(modeTrigger()?.textContent).toContain("Path");

    await chooseMode("Text");
    await act(async () => userEvent.setup().type(literalInput()!, "foo"));
    expect(literalInput()?.value).toBe("foo");

    await act(async () => userEvent.setup().click(toggle()!));
    expect(literalInput()).toBeNull();

    await act(async () => userEvent.setup().click(toggle()!));
    expect(modeTrigger()?.textContent).toContain("Text");
    expect(literalInput()?.value).toBe("foo");
  });

  it("keeps a cleared mapping cleared when the variable is erased and retyped", async () => {
    render({ literalMapping: { somevar: "foo" } });
    expect(modeTrigger()?.textContent).toContain("Text");

    await chooseMode("Path");
    await act(async () =>
      userEvent.setup().type(pathInput()!, "input.question")
    );
    expect(pathInput()?.value).toBe("input.question");

    await act(async () => userEvent.setup().click(toggle()!));
    await act(async () => userEvent.setup().click(toggle()!));

    expect(modeTrigger()?.textContent).toContain("Path");
    expect(pathInput()?.value).toBe("input.question");
    expect(literalInput()).toBeNull();
  });

  it("clears the shadowed mapping when a field mounts with both set", async () => {
    render({
      pathMapping: { somevar: "input.question" },
      literalMapping: { somevar: "foo" },
    });

    expect(modeTrigger()?.textContent).toContain("Text");
    expect(literalInput()?.value).toBe("foo");

    await chooseMode("Path");
    expect(pathInput()?.value).toBe("");
  });
});

describe("hasMappingValue", () => {
  it.each([
    ["foo", true],
    [false, true],
    [0, true],
    ["", false],
    [undefined, false],
    [null, false],
  ])("treats %p as present: %p", (value, expected) => {
    expect(hasMappingValue(value)).toBe(expected);
  });
});

describe("resolveMappingMode", () => {
  it.each([
    [undefined, undefined, "literal", "literal"],
    ["input.question", "", "literal", "path"],
    ["", "foo", "path", "literal"],
    [undefined, false, "path", "literal"],
  ] as const)(
    "path %p, literal %p, fallback %p resolves to %p",
    (pathValue, literalValue, fallbackMode, expected) => {
      expect(
        resolveMappingMode({ pathValue, literalValue, fallbackMode })
      ).toBe(expected);
    }
  );
});
