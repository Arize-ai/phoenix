import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { GlobalEvaluatorsEmptyState } from "@phoenix/pages/evaluators/GlobalEvaluatorsEmptyState";

/**
 * "In Context" empty states.
 *
 * Each story reconstructs an existing empty-state site using the shared
 * `EmptyState` / `EmptyStateGraphic` abstraction — i.e. it shows the *proposed*
 * migration of the existing content, not the current hand-rolled JSX. This
 * doubles as the drop-in spec: each config is what should land in the real
 * component.
 *
 * Conventions applied here (and to carry into the real migration):
 *   - Actions are a single strip mixing links and buttons.
 *   - Links for external destinations (Docs, Quickstart, Example); buttons for
 *     in-product behaviors (Playground, Run, Get Started, Set up Sessions).
 *   - Buttons carry no leading icons.
 *   - "Set up" is a verb ("Set up Sessions"), never the noun "Setup".
 *   - "Docs", not "Documentation".
 *
 * No data/GraphQL/router glue is needed: `.storybook/preview.tsx` wraps every
 * story in ThemeProvider → PreferencesProvider → MemoryRouter.
 *
 * Story-name prefixes group the empty states by their production context:
 *   "Marquee — …"  full-page zero-states
 *   "Table — …"    rendered inside a table tbody
 *   "Span — …"     trace/span detail empties
 */
const meta: Meta = {
  title: "Empty States/In Context",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal table frame for the empty states that live inside a table. The header
 * row is the one piece of surrounding context that affects how the empty state
 * reads in-frame; `TableEmptyWrap` supplies the `<tbody>`/`<td>` the real sites
 * use, so the `EmptyState` block sits exactly where it would in production.
 *
 * (Header labels are representative placeholders, not the real column defs.)
 */
function TableShell({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <table
      css={css`
        width: 100%;
        border-collapse: collapse;
        th {
          text-align: left;
          padding: var(--global-dimension-size-100)
            var(--global-dimension-size-200);
          border-bottom: 1px solid var(--global-border-color-default);
          color: var(--global-text-color-700);
          font-weight: 600;
          font-size: var(--global-font-size-s);
        }
      `}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      {children}
    </table>
  );
}

// ---------------------------------------------------------------------------
// Marquee — full-page zero-states
// ---------------------------------------------------------------------------

export const MarqueeDatasets: Story = {
  name: "Marquee — Datasets",
  render: () => (
    <EmptyState
      graphic={<EmptyStateGraphic variant="dataset" />}
      description="Create datasets for testing prompts, experimentation, and fine-tuning."
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "Docs",
            href: "https://arize.com/docs/phoenix/datasets-and-experiments/how-to-datasets",
          },
          {
            kind: "link",
            label: "Quickstart",
            href: "https://arize.com/docs/phoenix/get-started/get-started-datasets-and-experiments",
          },
        ],
      }}
    />
  ),
};

export const MarqueePrompts: Story = {
  name: "Marquee — Prompts",
  render: () => (
    <EmptyState
      graphic={<EmptyStateGraphic variant="prompt" />}
      description="Create and manage prompt templates for your AI applications."
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "Docs",
            href: "https://arize.com/docs/phoenix/get-started/get-started-prompt-playground",
          },
          {
            kind: "button",
            variant: "primary",
            children: "Playground",
            onPress: () => {},
          },
        ],
      }}
    />
  ),
};

export const MarqueeExperiments: Story = {
  name: "Marquee — Experiments",
  render: () => (
    <EmptyState
      graphic={<EmptyStateGraphic variant="experiment" />}
      description="Run experiments to evaluate and improve your AI applications."
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "Docs",
            href: "https://docs.arize.com/phoenix/datasets-and-experiments/how-to-experiments/run-experiments",
          },
          {
            kind: "link",
            label: "Example",
            href: "https://docs.arize.com/phoenix/cookbook/datasets-and-experiments/summarization",
          },
          {
            kind: "button",
            variant: "primary",
            children: "Run Dataset Experiment",
            onPress: () => {},
          },
        ],
      }}
    />
  ),
};

/**
 * PUNTED — not representable today, and shown here as the real component so the
 * detail is preserved for whoever designs its replacement.
 *
 * The two "LLM Evaluators" / "Code Evaluators" cards are not interactive (no
 * link) — styling them as cards misrepresents them. They're really a composite
 * *graphic* explaining the two evaluator types, and deserve a dedicated
 * `EmptyStateGraphic` variant that keeps that detail, not the `cards` action.
 */
export const MarqueeEvaluatorsPunted: Story = {
  name: "Marquee — Evaluators (punted, real component)",
  render: () => <GlobalEvaluatorsEmptyState hasActiveFilter={false} />,
};

// ---------------------------------------------------------------------------
// Table — rendered inside a table tbody
// ---------------------------------------------------------------------------

export const TableTraces: Story = {
  name: "Table — Traces",
  render: () => (
    <TableShell columns={["Trace ID", "Name", "Input", "Output", "Latency"]}>
      <TableEmptyWrap>
        <EmptyState
          graphic={<EmptyStateGraphic variant="trace" />}
          description="No traces found that match the selected filters"
          action={{
            type: "strip",
            items: [
              { kind: "button", children: "Get Started", onPress: () => {} },
            ],
          }}
        />
      </TableEmptyWrap>
    </TableShell>
  ),
};

export const TableSessions: Story = {
  name: "Table — Sessions",
  render: () => (
    <TableShell columns={["Session ID", "Start time", "Tokens", "Latency"]}>
      <TableEmptyWrap>
        <EmptyState
          graphic={<EmptyStateGraphic variant="session" />}
          description="No sessions found for this project"
          action={{
            type: "strip",
            items: [
              {
                kind: "button",
                children: "Set up Sessions",
                onPress: () => {},
              },
            ],
          }}
        />
      </TableEmptyWrap>
    </TableShell>
  ),
};

// ---------------------------------------------------------------------------
// Span — trace/span detail empties
// ---------------------------------------------------------------------------

export const SpanAnnotations: Story = {
  name: "Span — Annotations",
  render: () => (
    <EmptyState
      graphic={<EmptyStateGraphic variant="annotation" />}
      description="No annotations for this span"
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "How to Annotate",
            href: "https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/annotating-in-the-ui",
          },
        ],
      }}
    />
  ),
};
