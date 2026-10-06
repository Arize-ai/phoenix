import type { Meta, StoryObj } from "@storybook/react";
import { Focusable } from "react-aria";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { TooltipTrigger } from "@phoenix/components";
import { SpanPreviewTooltip } from "@phoenix/components/trace/SpanPreviewTooltip";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "@phoenix/components/trace/TokenDetailsBreakdown";
import type { ISpanItem } from "@phoenix/components/trace/types";

import { annotationConfigsByName } from "../../constants/annotationFixtures";
import { buildSpan } from "../../constants/spanFixtures";

const llmSpan = buildSpan({
  id: "llm-call",
  name: "LLM call 1: claude-fable-5-1",
  spanKind: "llm",
  startOffsetMs: 0,
  latencyMs: 3075,
  tokenCountTotal: 144604,
  costSummary: { total: { cost: 1.49 } },
});

const llmSpanDetails = {
  __typename: "Span",
  id: llmSpan.id,
  tokenCountTotal: 144604,
  tokenCountPrompt: 144293,
  tokenCountCompletion: 311,
  costSummary: {
    total: { cost: 1.49 },
    prompt: { cost: 1.47 },
    completion: { cost: 0.02 },
  },
  costDetailSummaryEntries: [
    {
      tokenType: "input",
      isPrompt: true,
      value: { tokens: 2, cost: 0.000006 },
    },
    {
      tokenType: "cache_read",
      isPrompt: true,
      value: { tokens: 26830, cost: 0.008 },
    },
    {
      tokenType: "cache_write",
      isPrompt: true,
      value: { tokens: 117461, cost: 1.462 },
    },
    {
      tokenType: "output",
      isPrompt: false,
      value: { tokens: 311, cost: 0.02 },
    },
  ],
};

function createRelayEnvironment(
  delayMs: number | null,
  outcome: "data" | "error" = "data"
) {
  return new Environment({
    network: Network.create(async () => {
      if (delayMs === null) {
        return new Promise(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (outcome === "error") {
        throw new TypeError("Failed to fetch");
      }
      return { data: { node: llmSpanDetails } };
    }),
    store: new Store(new RecordSource()),
  });
}

/**
 * The height reserved for the open tooltip, which is portaled and takes no
 * layout space itself.
 */
const PREVIEW_HEIGHT = 400;

/**
 * The preview held open against an empty anchor at the right of its frame,
 * where it opens to the left as it does beside a tree row.
 */
function OpenPreview({
  span,
  height = PREVIEW_HEIGHT,
}: {
  span: ISpanItem;
  height?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH + 48,
        height,
      }}
    >
      <TooltipTrigger isOpen>
        <Focusable>
          <span tabIndex={-1} style={{ display: "block", height: 32 }} />
        </Focusable>
        <SpanPreviewTooltip
          span={span}
          annotationConfigsByName={annotationConfigsByName}
        />
      </TooltipTrigger>
    </div>
  );
}

/**
 * The tooltip each trace tree row opens: a `Span Preview Card` that loads
 * the span's token and cost breakdown once the tooltip has settled, with the
 * row's totals and annotations shown at once. A span with no usage has
 * nothing to load. `Span Preview Card` shows every shape of the content.
 *
 * React Aria positions a tooltip against the viewport and offers no other
 * boundary, so each story renders in a frame of its own on this page.
 */
const meta: Meta<typeof SpanPreviewTooltip> = {
  title: "Domains/Tracing/Span Preview Tooltip",
  tags: ["updated", "complete", "unreviewed"],
  component: SpanPreviewTooltip,
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
    // One frame holds both themes, stacked.
    docs: { story: { inline: false, height: `${PREVIEW_HEIGHT * 2 + 96}px` } },
  },
};

export default meta;
type Story = StoryObj<typeof SpanPreviewTooltip>;

const delayedRelayEnvironment = createRelayEnvironment(600);

/** The breakdown loads after a short delay; no requests leave the story. */
export const Default: Story = {
  tags: ["!dev"],
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={delayedRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  render: () => <OpenPreview span={llmSpan} />,
};

const pendingRelayEnvironment = createRelayEnvironment(null);

/**
 * While the breakdown is in flight a skeleton of it holds its place, with
 * the row's totals real inside it, so the tooltip never blanks or shows a
 * spinner and does not grow when the breakdown lands. This story's request
 * never completes.
 */
export const DetailsPending: Story = {
  name: "Details Pending",
  tags: ["!dev"],
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={pendingRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  render: () => <OpenPreview span={llmSpan} />,
};

const failedRelayEnvironment = createRelayEnvironment(600, "error");

const FAILED_PREVIEW_HEIGHT = 120;

/**
 * When the breakdown fails to load, the preview gives way to an `error`
 * label. Hovering the label shows the request's error message.
 */
export const DetailsFailed: Story = {
  name: "Details Failed",
  tags: ["!dev"],
  parameters: {
    docs: {
      story: { inline: false, height: `${FAILED_PREVIEW_HEIGHT * 2 + 96}px` },
    },
  },
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={failedRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  render: () => <OpenPreview span={llmSpan} height={FAILED_PREVIEW_HEIGHT} />,
};

const immediateRelayEnvironment = createRelayEnvironment(0);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.4 } },
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={immediateRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  render: () => <OpenPreview span={llmSpan} />,
};
