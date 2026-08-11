import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";

const annotations = [
  {
    id: "annotation-1",
    name: "quality",
    label: "pass",
    score: 0.9,
    explanation: "Grounded in the supplied context.",
    annotatorKind: "HUMAN",
    createdAt: "2026-08-07T12:00:00.000Z",
    user: { username: "alice" },
  },
  {
    id: "annotation-2",
    name: "quality",
    label: "fail",
    score: 0.1,
    explanation: "Misses a required citation.",
    annotatorKind: "LLM",
    createdAt: "2026-08-07T11:00:00.000Z",
    user: null,
  },
  {
    id: "annotation-3",
    name: "quality",
    label: null,
    score: null,
    explanation: "Explains the result without assigning a value.",
    annotatorKind: "CODE",
    createdAt: "2026-08-07T10:00:00.000Z",
    user: { username: "bob" },
  },
] as const;

const explanationOnlyAnnotations = [
  {
    id: "annotation-4",
    name: "rationale-only",
    label: null,
    score: null,
    explanation: "This should not produce an empty token.",
    annotatorKind: "LLM",
    createdAt: "2026-08-07T09:00:00.000Z",
    user: null,
  },
] as const;

const meta = {
  title: "Annotation/Annotation Summary Tokens",
  component: AnnotationSummaryTokens,
  parameters: {
    layout: "centered",
  },
  args: {
    summaries: [
      { name: "quality", meanScore: 0.6, labelFractions: [] },
      { name: "rationale-only", meanScore: null, labelFractions: [] },
    ],
    annotationsByName: {
      quality: annotations,
      "rationale-only": explanationOnlyAnnotations,
    },
    annotationConfigsByName: new Map([
      [
        "quality",
        {
          annotationType: "FREEFORM" as const,
          optimizationDirection: "MAXIMIZE",
          threshold: 0.5,
        },
      ],
    ]),
    showFilterActions: true,
    renderFilterActions: (annotation) => (
      <button type="button">Filter {annotation.label}</button>
    ),
  },
} satisfies Meta<typeof AnnotationSummaryTokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HoverDetailsAndClickPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const triggers = canvas.getAllByRole("button");
    await expect(triggers).toHaveLength(1);
    const trigger = triggers[0];
    if (trigger == null) {
      throw new Error("Annotation summary trigger was not rendered");
    }

    await expect(trigger).toHaveTextContent("Favorable score: 0.6");
    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    const preview = await body.findByRole("dialog", undefined, {
      timeout: 2000,
    });
    await expect(within(preview).getByText("quality")).toBeInTheDocument();
    await expect(
      within(preview).getByText("Grounded in the supplied context.")
    ).toBeInTheDocument();
    await expect(
      within(preview).getByText("Misses a required citation.")
    ).toBeInTheDocument();
    await expect(
      within(preview).getByText(
        "Explains the result without assigning a value."
      )
    ).toBeInTheDocument();
    await expect(within(preview).getAllByRole("listitem")).toHaveLength(3);
    await expect(preview).toHaveTextContent("Favorable score: 0.9");
    await expect(preview).toHaveTextContent("Unfavorable score: 0.1");

    await userEvent.click(trigger);
    const filterPassButton = await body.findByRole("button", {
      name: "Filter pass",
    });
    const dialog = filterPassButton.closest<HTMLElement>('[role="dialog"]');
    if (dialog == null) {
      throw new Error("Annotation filter actions dialog was not rendered");
    }
    await expect(within(dialog).getByText("alice")).toBeInTheDocument();
    await expect(within(dialog).getByText("system")).toBeInTheDocument();
    await expect(filterPassButton).toBeInTheDocument();
    await expect(
      within(dialog).getByRole("button", { name: "Filter fail" })
    ).toBeInTheDocument();
    await expect(within(dialog).queryAllByRole("row")).toHaveLength(3);
  },
};
