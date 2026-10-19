import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria";

import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";
import type {
  TokenDetailsBreakdownProps,
  TokenDetailTotals,
} from "@phoenix/components/trace/TokenDetailsBreakdown";
import {
  TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
  TokenDetailsBreakdown,
  TokenDetailsBreakdownSkeleton,
} from "@phoenix/components/trace/TokenDetailsBreakdown";

/**
 * The body of every token and cost tooltip in the app: the trace tree's row
 * preview, the span header, and the token counts and costs in tables.
 *
 * A bar per measure splits the total into token types, with a tick where the
 * prompt ends and the completion begins, and a table gives each type's value
 * and share in every measure. Because the bars share their segments, a type's
 * share of the tokens reads against its share of the cost: cache reads that
 * are most of the context window but a fraction of the bill.
 *
 * `TokenCountDetails` and `TokenCostsDetails` are thin wrappers over this
 * component for surfaces that show one measure only; the cost tooltips of
 * `Token Costs` render `TokenCostsDetails`, so their content is documented
 * here. `TokenDetailsBreakdownSkeleton` stands in while a tooltip's split
 * loads.
 *
 * `Content Types` and `Loading` render the content inline, at the width it
 * gets inside its tooltip, so every case can be compared at once. `In
 * Tooltip` shows it held open in the tooltip itself.
 */
const meta = {
  title: "Domains/Cost/Token Details Breakdown",
  component: TokenDetailsBreakdown,
  subcomponents: { TokenCostsDetails, TokenDetailsBreakdownSkeleton },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
  tags: ["updated", "unreviewed", "incomplete"],
} satisfies Meta<typeof TokenDetailsBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The content width of a tooltip that shows tokens and cost together.
 * `RichTooltip` is content-box, so its `width` is the content's width and
 * its padding sits outside it.
 */
const BOTH_MEASURES_CONTENT_WIDTH = TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH;

/**
 * The content width cap of a tooltip left at its default size, as the
 * single-measure tooltips are: `RichTooltip`'s 300px `max-width`, which also
 * applies to its content box. Below the cap the tooltip shrinks to its
 * content.
 */
const SINGLE_MEASURE_CONTENT_MAX_WIDTH = 300;

/** A cached LLM call, priced. */
const tokensAndCost = {
  tokens: {
    total: 49_494,
    prompt: 48_210,
    completion: 1_284,
    promptDetails: { input: 3_490, cache_read: 41_600, cache_write: 3_120 },
  },
  costs: {
    total: 0.0539,
    prompt: 0.0347,
    completion: 0.0193,
    promptDetails: { input: 0.0105, cache_read: 0.0125, cache_write: 0.0117 },
  },
} satisfies TokenDetailsBreakdownProps;

/** Token counts alone, as a local model reports them. */
const tokensOnly = {
  tokens: { total: 812, prompt: 600, completion: 212 },
} satisfies TokenDetailsBreakdownProps;

/** Cost alone, with token types on both sides. */
const costOnly = {
  costs: {
    total: 27.09,
    prompt: 24.04,
    completion: 3.05,
    promptDetails: { input: 4.04, cache_read: 16.0, cache_write: 4.0 },
    completionDetails: { output: 2.05, reasoning: 1.0 },
  },
} satisfies TokenDetailsBreakdownProps;

/**
 * A cost tooltip's details, as the span cost tooltip loads them. Shown in
 * `Loading` against the skeleton its tooltip opens on.
 */
const costLoadedDetails = {
  total: 0.089,
  prompt: 0.052,
  completion: 0.037,
  promptDetails: { input: 0.025, cache_read: 0.015, tool: 0.012 },
  completionDetails: { output: 0.025, reasoning: 0.012 },
} satisfies TokenDetailTotals;

/**
 * The width a case gets inside its tooltip: fixed when both measures show,
 * shrink-to-fit under the default cap when one does.
 */
function TooltipContentWidth({
  hasBothMeasures,
  children,
}: {
  hasBothMeasures: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={
        hasBothMeasures
          ? { width: BOTH_MEASURES_CONTENT_WIDTH }
          : { width: "fit-content", maxWidth: SINGLE_MEASURE_CONTENT_MAX_WIDTH }
      }
    >
      {children}
    </div>
  );
}

/** One labeled case of the `Content Types` stack. */
function ContentCase({
  label,
  description,
  hasBothMeasures = false,
  children,
}: {
  label: string;
  description: string;
  hasBothMeasures?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: BOTH_MEASURES_CONTENT_WIDTH,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Text size="S" weight="heavy">
          {label}
        </Text>
        <Text size="XS" color="text-700">
          {description}
        </Text>
      </div>
      <TooltipContentWidth hasBothMeasures={hasBothMeasures}>
        {children}
      </TooltipContentWidth>
    </section>
  );
}

/**
 * Every shape the breakdown takes once loaded, unfolded one above the other
 * at the width each gets in its tooltip. Tokens and cost together use the
 * wide tooltip; one measure alone uses the default tooltip, which shrinks to
 * fit it. The cost cases render `TokenCostsDetails`, as the cost tooltips of
 * `Token Costs` do.
 */
export const ContentTypes: Story = {
  name: "Content Types",
  parameters: {
    themeLayout: "row",
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <ContentCase
        label="Tokens and cost"
        description="A cached LLM call, priced. Cache reads dominate the tokens but not the cost, and the output is the reverse."
        hasBothMeasures
      >
        <TokenDetailsBreakdown {...tokensAndCost} />
      </ContentCase>
      <ContentCase
        label="Tokens only"
        description="Token counts alone, as a local model reports them. With no token types recorded, each side is one plain segment."
      >
        <TokenDetailsBreakdown {...tokensOnly} />
      </ContentCase>
      <ContentCase
        label="Cost only"
        description="Cost alone, as a cost tooltip in a table shows it. Reasoning tokens keep the color they carry in the project metrics charts."
      >
        <TokenDetailsBreakdown {...costOnly} />
      </ContentCase>
      <ContentCase
        label="Totals only"
        description="Totals whose split was never recorded: one neutral bar per measure and no table. A final state, not a loading one."
        hasBothMeasures
      >
        <TokenDetailsBreakdown
          tokens={{ total: tokensAndCost.tokens.total }}
          costs={{ total: tokensAndCost.costs.total }}
        />
      </ContentCase>
      <ContentCase
        label="Average"
        description="An experiment's average per run, where the totals are qualified in the heading rather than plain."
      >
        <TokenDetailsBreakdown {...costOnly} totalLabel="Average" />
      </ContentCase>
      <ContentCase
        label="Incomplete details"
        description="Only the cache is broken out. The prompt tokens the details do not account for surface as Input, so the bar still fills its total."
      >
        <TokenDetailsBreakdown
          tokens={{
            total: 84_320,
            prompt: 78_100,
            completion: 6_220,
            promptDetails: { cache_read: 61_326 },
          }}
        />
      </ContentCase>
      <ContentCase
        label="Type on both sides"
        description="Audio heard in the prompt and spoken in the completion is told apart by side, and the second side gives up the type's color."
      >
        <TokenDetailsBreakdown
          tokens={{
            total: 9_400,
            prompt: 7_000,
            completion: 2_400,
            promptDetails: { input: 3_000, audio: 4_000 },
            completionDetails: { output: 1_400, audio: 1_000 },
          }}
        />
      </ContentCase>
      <ContentCase
        label="Cost split, no token types"
        description="A cost's prompt and completion without per-type details: one plain segment per side."
      >
        <TokenCostsDetails total={0.0342} prompt={0.023} completion={0.0112} />
      </ContentCase>
      <ContentCase
        label="Cost with every token type"
        description="Five prompt types and three completion types, so the table runs long."
      >
        <TokenCostsDetails
          total={0.157}
          prompt={0.096}
          completion={0.061}
          promptDetails={{
            input: 0.045,
            cache_read: 0.012,
            cache_write: 0.008,
            tool: 0.021,
            audio: 0.01,
          }}
          completionDetails={{
            output: 0.035,
            reasoning: 0.016,
            function_calls: 0.01,
          }}
        />
      </ContentCase>
      <ContentCase
        label="High cost with every token type"
        description="The same token types at dollar scale: values of a dollar or more drop from four decimals to two."
      >
        <TokenCostsDetails
          total={2.45}
          prompt={1.23}
          completion={1.22}
          promptDetails={{
            input: 0.45,
            cache_read: 0.23,
            cache_write: 0.15,
            tool: 0.28,
            audio: 0.12,
          }}
          completionDetails={{
            output: 0.67,
            reasoning: 0.35,
            function_calls: 0.2,
          }}
        />
      </ContentCase>
      <ContentCase
        label="Prompt only"
        description="A prompt cost with no completion and no total: the total is the sum of the parts, with no split summary and no prompt tick."
      >
        <TokenCostsDetails
          prompt={0.0234}
          promptDetails={{ input: 0.018, tool: 0.0054 }}
        />
      </ContentCase>
      <ContentCase
        label="Completion only"
        description="A completion cost with no prompt and no total."
      >
        <TokenCostsDetails
          completion={0.0412}
          completionDetails={{ output: 0.0312, reasoning: 0.01 }}
        />
      </ContentCase>
    </div>
  ),
};

/**
 * The skeleton every token and cost tooltip opens on while its breakdown
 * loads, above the breakdown it turns into. Each tooltip passes the skeleton
 * only the totals it already has, so the heading, the measure labels and the
 * totals are real, and the split, the bars and the table rows pulse in their
 * places on the loaded layout's grid. The header, bars, rule and table
 * columns hold still when the details land; the skeleton's three table rows
 * are a guess at how many token types the usage has, and are all that can
 * change.
 */
export const Loading: Story = {
  parameters: {
    themeLayout: "column",
  },
  render: () => {
    const columns: {
      label: string;
      hasBothMeasures: boolean;
      loading: ReactNode;
      loaded: ReactNode;
    }[] = [
      {
        label: "Tokens and cost",
        hasBothMeasures: true,
        loading: (
          <TokenDetailsBreakdownSkeleton
            tokens={{ total: tokensAndCost.tokens.total }}
            costs={{ total: tokensAndCost.costs.total }}
          />
        ),
        loaded: <TokenDetailsBreakdown {...tokensAndCost} />,
      },
      {
        label: "Tokens only",
        hasBothMeasures: false,
        loading: (
          <TokenDetailsBreakdownSkeleton
            tokens={{ total: tokensOnly.tokens.total }}
          />
        ),
        loaded: <TokenDetailsBreakdown {...tokensOnly} />,
      },
      {
        label: "Cost only",
        hasBothMeasures: false,
        loading: (
          <TokenDetailsBreakdownSkeleton
            costs={{ total: costLoadedDetails.total }}
          />
        ),
        loaded: <TokenCostsDetails {...costLoadedDetails} />,
      },
    ];
    const rows: { label: string; cell: "loading" | "loaded" }[] = [
      { label: "Loading", cell: "loading" },
      { label: "Loaded", cell: "loaded" },
    ];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `auto repeat(${columns.length}, auto)`,
          columnGap: 40,
          rowGap: 24,
          alignItems: "start",
        }}
      >
        <div />
        {columns.map((column) => (
          <Text key={column.label} size="S" weight="heavy">
            {column.label}
          </Text>
        ))}
        {rows.map((row) => [
          <Text key={row.label} size="S" weight="heavy">
            {row.label}
          </Text>,
          ...columns.map((column) => (
            <TooltipContentWidth
              key={`${row.label}-${column.label}`}
              hasBothMeasures={column.hasBothMeasures}
            >
              {column[row.cell]}
            </TooltipContentWidth>
          )),
        ])}
      </div>
    );
  },
};

/**
 * How the breakdown is actually seen: inside the tooltip of a cost, where it
 * has to stay legible at tooltip width. Held open through the trigger, so
 * hovering or leaving the cost does not close it.
 */
export const InTooltip: Story = {
  name: "In Tooltip",
  parameters: { themeLayout: "row" },
  render: () => (
    // The open tooltip is portaled and takes no layout space, so reserve
    // room for it below the cost.
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH + 40,
        height: 380,
      }}
    >
      <TooltipTrigger isOpen>
        <Pressable>
          <TokenCosts role="button" tabIndex={0}>
            {tokensAndCost.costs.total}
          </TokenCosts>
        </Pressable>
        <RichTooltip
          placement="bottom"
          width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
        >
          <TooltipArrow />
          <TokenDetailsBreakdown {...tokensAndCost} />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => <TokenDetailsBreakdown {...tokensAndCost} />,
  parameters: {
    layout: "padded",
    width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
    thumbnail: { scale: 0.55 },
  },
};
