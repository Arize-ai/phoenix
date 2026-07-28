import type { Meta, StoryObj } from "@storybook/react";

import {
  SpanNotesListContent,
  type SpanNote,
} from "@phoenix/pages/trace/SpanNotesList";

import {
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const notes: SpanNote[] = [
  {
    id: "note-1",
    explanation:
      "The retriever returned onboarding docs for a billing question.",
    createdAt: "2026-07-23T16:00:00.000Z",
    user: { username: "alice" },
  },
  {
    id: "note-2",
    explanation:
      "The agent retried the same invalid tool argument twice before recovering.\nThe second retry produced the same validation error as the first.",
    createdAt: "2026-07-23T16:02:00.000Z",
    user: null,
  },
  {
    id: "note-3",
    explanation: "The final answer correctly acknowledged the failed lookup.",
    createdAt: "2026-07-23T16:04:00.000Z",
    user: { username: "reviewer@example.com" },
  },
];

const meta = {
  title: "Detail panel/Notes",
  component: SpanNotesListContent,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanNotesListContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: { notes },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty">
        <SpanNotesListContent notes={[]} />
      </DetailPanelExample>
      <DetailPanelExample title="One note">
        <SpanNotesListContent notes={[notes[0]]} />
      </DetailPanelExample>
      <DetailPanelExample title="Stacked notes">
        <SpanNotesListContent notes={notes} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
};
