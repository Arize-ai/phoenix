import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@phoenix/components/ai/attachment";
import type {
  AttachmentContextData,
  AttachmentData,
  AttachmentFileData,
  AttachmentSourceData,
} from "@phoenix/components/ai/attachment";

const containerCSS = css`
  width: 600px;
`;

const meta = {
  title: "AI/Attachments",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Labels mirror the format conventions in agentContextTypes.ts:
// - project / span pills carry relay node IDs (base64)
// - trace pills carry OpenTelemetry hex IDs
const CONTEXT_DATA: AttachmentContextData[] = [
  { type: "context", id: "project:abc", category: "project", label: "Project" },
  {
    type: "context",
    id: "trace:1",
    category: "trace",
    label: "Trace",
    detail: "ee6a3a45...",
  },
  {
    type: "context",
    id: "span:2",
    category: "span",
    label: "Span",
    detail: "U3BhbjoxMTIz",
  },
  {
    type: "context",
    id: "filter:1",
    category: "span_filter",
    label: "Filter",
    detail: 'status_code = "ERROR"',
  },
];

const IMAGE_FILE: AttachmentFileData = {
  type: "file",
  id: "img-1",
  mediaType: "image/jpeg",
  url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=200",
  filename: "cat.jpg",
};

const DOCUMENT_FILE: AttachmentFileData = {
  type: "file",
  id: "doc-1",
  mediaType: "application/pdf",
  url: "",
  filename: "report-q4.pdf",
};

const AUDIO_FILE: AttachmentFileData = {
  type: "file",
  id: "audio-1",
  mediaType: "audio/mpeg",
  url: "",
  filename: "voice-memo.mp3",
};

const SOURCE_DOC: AttachmentSourceData = {
  type: "source-document",
  id: "src-1",
  sourceId: "src-1",
  mediaType: "text/plain",
  title: "Phoenix Observability Whitepaper",
  filename: "phoenix.pdf",
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Inline pills for non-removable agent contexts. This is the shape used by
 * `AgentContextPills` to advertise what Phoenix state the agent can see for
 * the next chat turn. Omitting `onRemove` hides the close button.
 */
export const ContextPills: Story = {
  render: () => (
    <div css={containerCSS}>
      <Attachments variant="inline">
        {CONTEXT_DATA.map((data) => (
          <Attachment key={data.id} data={data}>
            <AttachmentPreview />
            <AttachmentInfo />
          </Attachment>
        ))}
      </Attachments>
    </div>
  ),
};

/**
 * Collapsible context stack. At rest the chips overlap into a single-line
 * stack — the last chip stays fully visible, the rest tuck behind it as
 * icon-only badges, and every id/detail is hidden. Hover (or focus) the group
 * to fan the stack out and reveal each detail.
 *
 * This is the shape `AgentContextPills` uses above the chat input so a long
 * list of contexts stays compact until the user wants to inspect it.
 */
export const CollapsibleStack: Story = {
  render: () => (
    <div css={containerCSS}>
      <Attachments variant="inline" collapsible>
        {CONTEXT_DATA.map((data) => (
          <Attachment key={data.id} data={data}>
            <AttachmentPreview />
            <AttachmentInfo />
          </Attachment>
        ))}
      </Attachments>
    </div>
  ),
};

/**
 * Inline pills with a remove handler. The close button reveals on hover.
 */
export const InlineRemovable: Story = {
  render: function InlineRemovableStory() {
    const [items, setItems] = useState<AttachmentData[]>([
      ...CONTEXT_DATA.slice(0, 2),
      IMAGE_FILE,
      DOCUMENT_FILE,
    ]);
    return (
      <div css={containerCSS}>
        <Attachments variant="inline">
          {items.map((data) => (
            <Attachment
              key={data.id}
              data={data}
              onRemove={() =>
                setItems((xs) => xs.filter((x) => x.id !== data.id))
              }
            >
              <AttachmentPreview />
              <AttachmentInfo />
              <AttachmentRemove />
            </Attachment>
          ))}
        </Attachments>
      </div>
    );
  },
};

/**
 * Square thumbnail tiles. Suited to image / video previews. The remove
 * button overlays in the top-right and reveals on hover.
 */
export const Grid: Story = {
  render: function GridStory() {
    const [items, setItems] = useState<AttachmentData[]>([
      IMAGE_FILE,
      { ...IMAGE_FILE, id: "img-2" },
      DOCUMENT_FILE,
      AUDIO_FILE,
    ]);
    return (
      <div css={containerCSS}>
        <Attachments variant="grid">
          {items.map((data) => (
            <Attachment
              key={data.id}
              data={data}
              onRemove={() =>
                setItems((xs) => xs.filter((x) => x.id !== data.id))
              }
            >
              <AttachmentPreview />
              <AttachmentRemove />
            </Attachment>
          ))}
        </Attachments>
      </div>
    );
  },
};

/**
 * Full-width rows with a leading thumbnail and trailing remove button.
 * Useful for file pickers or source-document citation lists.
 */
export const List: Story = {
  render: function ListStory() {
    const [items, setItems] = useState<AttachmentData[]>([
      IMAGE_FILE,
      DOCUMENT_FILE,
      AUDIO_FILE,
      SOURCE_DOC,
    ]);
    return (
      <div css={containerCSS}>
        <Attachments variant="list">
          {items.map((data) => (
            <Attachment
              key={data.id}
              data={data}
              onRemove={() =>
                setItems((xs) => xs.filter((x) => x.id !== data.id))
              }
            >
              <AttachmentPreview />
              <AttachmentInfo showMediaType />
              <AttachmentRemove />
            </Attachment>
          ))}
        </Attachments>
      </div>
    );
  },
};

/**
 * Source-document citations rendered as inline chips. Demonstrates that the
 * same compound carries every attachment kind.
 */
export const SourceCitations: Story = {
  render: () => (
    <div css={containerCSS}>
      <Attachments variant="inline">
        {[
          SOURCE_DOC,
          { ...SOURCE_DOC, id: "src-2", title: "OpenInference Spec" },
        ].map((data) => (
          <Attachment key={data.id} data={data}>
            <AttachmentPreview />
            <AttachmentInfo />
          </Attachment>
        ))}
      </Attachments>
    </div>
  ),
};

/**
 * All variants stacked, including the non-removable context-pill mode.
 */
export const Gallery: Story = {
  render: () => (
    <Flex direction="column" gap="size-300">
      <Flex direction="column" gap="size-100">
        <Text>Inline (context pills, non-removable)</Text>
        <div css={containerCSS}>
          <Attachments variant="inline">
            {CONTEXT_DATA.map((data) => (
              <Attachment key={data.id} data={data}>
                <AttachmentPreview />
                <AttachmentInfo />
              </Attachment>
            ))}
          </Attachments>
        </div>
      </Flex>

      <Flex direction="column" gap="size-100">
        <Text>Grid</Text>
        <div css={containerCSS}>
          <Attachments variant="grid">
            {[IMAGE_FILE, DOCUMENT_FILE, AUDIO_FILE].map((data) => (
              <Attachment key={data.id} data={data} onRemove={() => undefined}>
                <AttachmentPreview />
                <AttachmentRemove />
              </Attachment>
            ))}
          </Attachments>
        </div>
      </Flex>

      <Flex direction="column" gap="size-100">
        <Text>List</Text>
        <div css={containerCSS}>
          <Attachments variant="list">
            {[IMAGE_FILE, DOCUMENT_FILE, SOURCE_DOC].map((data) => (
              <Attachment key={data.id} data={data} onRemove={() => undefined}>
                <AttachmentPreview />
                <AttachmentInfo showMediaType />
                <AttachmentRemove />
              </Attachment>
            ))}
          </Attachments>
        </div>
      </Flex>
    </Flex>
  ),
};
