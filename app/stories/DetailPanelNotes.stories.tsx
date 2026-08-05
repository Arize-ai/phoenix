import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

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
    annotatorKind: "HUMAN",
    id: "note-1",
    explanation:
      "The retriever returned onboarding docs for a billing question.",
    identifier: "manual-review",
    metadata: {},
    source: "APP",
    createdAt: "2026-07-23T16:00:00.000Z",
    updatedAt: "2026-07-23T16:00:00.000Z",
    user: { id: "user-1", username: "alice" },
  },
  {
    annotatorKind: "LLM",
    id: "note-2",
    explanation:
      "The agent retried the same invalid tool argument twice before recovering.\nThe second retry produced the same validation error as the first.",
    identifier: "automated-review",
    metadata: { workflow: "trace-review" },
    source: "API",
    createdAt: "2026-07-23T16:02:00.000Z",
    updatedAt: "2026-07-24T18:30:00.000Z",
    user: null,
  },
  {
    annotatorKind: "HUMAN",
    id: "note-3",
    explanation: "The final answer correctly acknowledged the failed lookup.",
    identifier: "pxi",
    metadata: { workflow: "trace-review" },
    source: "API",
    createdAt: "2026-07-23T16:04:00.000Z",
    updatedAt: "2026-07-23T16:04:00.000Z",
    user: { id: "user-2", username: "reviewer@example.com" },
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

function NotesFixture({ initialNotes }: { initialNotes: SpanNote[] }) {
  const [currentNotes, setCurrentNotes] = useState(initialNotes);
  return (
    <SpanNotesListContent
      notes={currentNotes}
      onDeleteNote={async (noteId) => {
        setCurrentNotes((existingNotes) =>
          existingNotes.filter((note) => note.id !== noteId)
        );
        return { success: true };
      }}
      onUpdateNote={async ({ noteId, noteText }) => {
        setCurrentNotes((existingNotes) =>
          existingNotes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  explanation: noteText,
                  updatedAt: "2026-07-24T18:30:00.000Z",
                }
              : note
          )
        );
        return { success: true };
      }}
    />
  );
}

export const Permutations: Story = {
  args: {
    notes,
    onDeleteNote: async () => ({ success: true }),
    onUpdateNote: async () => ({ success: true }),
  },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty">
        <NotesFixture initialNotes={[]} />
      </DetailPanelExample>
      <DetailPanelExample title="One note">
        <NotesFixture initialNotes={[notes[0]]} />
      </DetailPanelExample>
      <DetailPanelExample title="Stacked notes">
        <NotesFixture initialNotes={notes} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
};
