import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { EvaluationMetricsLabelCountSelect } from "../EvaluationMetricsLabelCountSelect";

describe("EvaluationMetricsLabelCountSelect", () => {
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

  it("offers every label count through the server-side maximum", async () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <EvaluationMetricsLabelCountSelect
          count={12}
          maxCount={12}
          onChange={onChange}
        />
      );
    });
    const user = userEvent.setup();
    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => user.click(button!));
    const fiveLabelOption = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((option) => option.textContent?.includes("top 5 labels"));
    expect(fiveLabelOption).not.toBeUndefined();

    await act(async () => user.click(fiveLabelOption!));

    expect(onChange).toHaveBeenCalledWith(5);
  });
});
