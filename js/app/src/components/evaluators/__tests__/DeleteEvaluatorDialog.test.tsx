import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import type { EvaluatorKind } from "@phoenix/types";

import { DeleteEvaluatorDialog } from "../DeleteEvaluatorDialog";

installTestMatchMedia();

function findByText({ text }: { text: string }) {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>("label, button")
  ).find((element) => element.textContent?.includes(text));
}

describe("DeleteEvaluatorDialog", () => {
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

  async function renderAndDelete({
    evaluatorKind,
    uncheck,
  }: {
    evaluatorKind: EvaluatorKind;
    uncheck?: string;
  }) {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <DeleteEvaluatorDialog
          evaluatorName="judge"
          evaluatorKind={evaluatorKind}
          target="dataset"
          isOpen
          isDeleting={false}
          onDelete={onDelete}
        />
      );
    });
    if (uncheck) {
      const checkbox = findByText({ text: uncheck });
      expect(checkbox).toBeDefined();
      await userEvent.click(checkbox as HTMLElement);
    }
    await userEvent.click(
      findByText({ text: "Delete evaluator" }) as HTMLElement
    );
    return onDelete;
  }

  it.each([
    ["LLM", "Delete associated prompt"],
    ["DECISION", "Delete associated decision"],
  ] as const)("defaults the %s checkbox on", async (evaluatorKind, label) => {
    expect(
      await renderAndDelete({ evaluatorKind }).then(
        (onDelete) => onDelete.mock.calls[0][0]
      )
    ).toEqual({ deleteUnusedPromptOrDecision: true });
    expect(findByText({ text: label })).toBeDefined();
  });

  it("sends false when the user unchecks the decision box", async () => {
    const onDelete = await renderAndDelete({
      evaluatorKind: "DECISION",
      uncheck: "Delete associated decision",
    });
    expect(onDelete).toHaveBeenCalledWith({
      deleteUnusedPromptOrDecision: false,
    });
  });

  it.each(["CODE", "BUILTIN"] as const)(
    "sends false explicitly for %s evaluators, which have no checkbox",
    async (evaluatorKind) => {
      const onDelete = await renderAndDelete({ evaluatorKind });
      expect(findByText({ text: "Delete associated" })).toBeUndefined();
      expect(onDelete).toHaveBeenCalledWith({
        deleteUnusedPromptOrDecision: false,
      });
    }
  );

  it("resets the checkbox back to checked after closing and reopening", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    let isOpen = true;
    const renderDialog = () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <DeleteEvaluatorDialog
            evaluatorName="judge"
            evaluatorKind="LLM"
            target="project"
            isOpen={isOpen}
            onOpenChange={(nextIsOpen) => {
              isOpen = nextIsOpen;
              renderDialog();
            }}
            isDeleting={false}
            onDelete={onDelete}
          />
        </ThemeProvider>
      );
    };

    act(() => {
      renderDialog();
    });

    const checkboxLabel = findByText({ text: "Delete associated prompt" });
    expect(checkboxLabel).toBeDefined();
    await act(async () => {
      await userEvent.click(checkboxLabel as HTMLElement);
    });
    await act(async () => {
      await userEvent.click(findByText({ text: "Cancel" }) as HTMLElement);
    });
    expect(isOpen).toBe(false);

    act(() => {
      isOpen = true;
      renderDialog();
    });

    await act(async () => {
      await userEvent.click(
        findByText({ text: "Delete evaluator" }) as HTMLElement
      );
    });
    expect(onDelete).toHaveBeenCalledWith({
      deleteUnusedPromptOrDecision: true,
    });
  });

  it("clears the error banner after closing and reopening", async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValueOnce(new Error("Evaluator is locked"));
    let isOpen = true;
    const renderDialog = () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <DeleteEvaluatorDialog
            evaluatorName="judge"
            evaluatorKind="LLM"
            target="project"
            isOpen={isOpen}
            onOpenChange={(nextIsOpen) => {
              isOpen = nextIsOpen;
              renderDialog();
            }}
            isDeleting={false}
            onDelete={onDelete}
          />
        </ThemeProvider>
      );
    };

    act(() => {
      renderDialog();
    });

    await act(async () => {
      await userEvent.click(
        findByText({ text: "Delete evaluator" }) as HTMLElement
      );
    });
    expect(document.body.textContent).toContain("Evaluator is locked");

    await act(async () => {
      await userEvent.click(findByText({ text: "Cancel" }) as HTMLElement);
    });
    expect(isOpen).toBe(false);

    act(() => {
      isOpen = true;
      renderDialog();
    });

    expect(document.body.textContent).not.toContain("Evaluator is locked");
  });
});
