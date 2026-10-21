import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

import { EvaluatorNameInput } from "../EvaluatorNameInput";

function ValidateButton() {
  const store = useEvaluatorStoreInstance();
  return (
    <button onClick={() => void store.getState().validateAll()}>submit</button>
  );
}

describe("EvaluatorNameInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <EvaluatorStoreProvider
          initialState={DEFAULT_LLM_EVALUATOR_STORE_VALUES}
        >
          <EvaluatorNameInput />
          <button>elsewhere</button>
          <ValidateButton />
        </EvaluatorStoreProvider>
      );
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not report an untouched empty name when focus leaves it, until submit validation runs", async () => {
    const user = userEvent.setup();
    const [elsewhere, submit] = Array.from(
      container.querySelectorAll("button")
    );
    await act(async () => {
      await user.click(elsewhere);
    });
    expect(container.textContent).not.toContain("Cannot be empty");

    await act(async () => {
      await user.click(submit);
    });
    expect(container.textContent).toContain("Cannot be empty");
  });

  it("reports an emptied name once the user has edited it", async () => {
    const user = userEvent.setup();
    const input = container.querySelector("input")!;
    await act(async () => {
      await user.type(input, "a");
      await user.clear(input);
      await user.tab();
    });
    expect(container.textContent).toContain("Cannot be empty");
  });
});
