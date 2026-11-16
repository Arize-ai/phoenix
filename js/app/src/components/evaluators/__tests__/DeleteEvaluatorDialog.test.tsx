import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EvaluatorKind } from "@phoenix/types";

import { DeleteEvaluatorDialog } from "../DeleteEvaluatorDialog";

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
      await userEvent.click(findByText({ text: uncheck }) as HTMLElement);
    }
    await userEvent.click(
      findByText({ text: "Delete evaluator" }) as HTMLElement
    );
    return onDelete;
  }

  it.each([
    ["LLM", "Delete associated prompt"],
    ["DECISION", "Delete associated decision"],
  ] as const)(
    "defaults the %s checkbox on and lets the user turn it off",
    async (evaluatorKind, label) => {
      expect(
        await renderAndDelete({ evaluatorKind }).then(
          (onDelete) => onDelete.mock.calls[0][0]
        )
      ).toEqual({ deleteUnusedPromptOrDecision: true });
      expect(findByText({ text: label })).toBeDefined();
    }
  );

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
});
