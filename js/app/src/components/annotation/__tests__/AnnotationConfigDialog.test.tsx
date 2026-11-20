import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type * as Contexts from "@phoenix/contexts";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import type { AnnotationConfigContinuous } from "@phoenix/pages/settings/types";

import { AnnotationConfigDialog } from "../AnnotationConfigDialog";

vi.mock("@phoenix/contexts", async (importOriginal) => ({
  ...(await importOriginal<typeof Contexts>()),
  useNotifySuccess: () => vi.fn(),
}));

const helpfulness: AnnotationConfigContinuous = {
  id: "ContinuousAnnotationConfig:8",
  annotationType: "CONTINUOUS",
  name: "helpfulness_score",
  description: null,
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 10,
  threshold: 7,
};

describe("AnnotationConfigDialog threshold", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(
    initial: AnnotationConfigContinuous,
    onAdd = vi.fn()
  ): Promise<typeof onAdd> {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <AnnotationConfigDialog
            onAddAnnotationConfig={onAdd}
            initialAnnotationConfig={initial}
          />
        </ThemeContext.Provider>
      );
    });
    return onAdd;
  }

  function thresholdInput(): HTMLInputElement {
    const label = Array.from(document.querySelectorAll("label")).find((el) =>
      el.textContent?.startsWith("Threshold")
    );
    expect(label).toBeDefined();
    const input = document.getElementById(label!.htmlFor) as HTMLInputElement;
    return (
      input ??
      (label!.parentElement!.querySelector("input") as HTMLInputElement)
    );
  }

  async function submit() {
    const button = Array.from(document.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("Update Annotation Config")
    );
    await act(async () => {
      button!.click();
    });
  }

  it("shows the saved threshold with the direction's hint", async () => {
    await render(helpfulness);
    expect(thresholdInput().value).toBe("7");
    expect(document.body.textContent).toContain(
      "Good results are at or above this"
    );
  });

  it("submits the threshold with the config", async () => {
    const onAdd = await render(helpfulness);
    await submit();
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      annotationType: "CONTINUOUS",
      lowerBound: 0,
      upperBound: 10,
      threshold: 7,
    });
  });

  it("submits a null threshold when none is set", async () => {
    const onAdd = await render({ ...helpfulness, threshold: null });
    await submit();
    expect(onAdd.mock.calls[0][0]).toMatchObject({ threshold: null });
  });

  it("refuses a threshold outside the bounds", async () => {
    const onAdd = await render({ ...helpfulness, threshold: 10 });
    await submit();
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Threshold must be less than the upper bound"
    );
  });
});
