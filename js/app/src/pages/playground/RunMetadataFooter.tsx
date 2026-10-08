import { Suspense } from "react";
import { Pressable } from "react-aria";
import { useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";
import { graphql } from "relay-runtime";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  RichTooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TokenDetailsBreakdown } from "@phoenix/components/trace/TokenDetailsBreakdown";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import type { RunMetadataFooterQuery } from "./__generated__/RunMetadataFooterQuery.graphql";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";

type TokenSource = "span" | "decision";

/** Input and output counts a decision span recorded under decision.token_count.* */
function getDecisionTokenCounts(
  attributesJSON: string | null | undefined
): { input: number | null; output: number | null } | null {
  if (!attributesJSON) return null;
  try {
    const attributes: unknown = JSON.parse(attributesJSON);
    const tokenCount =
      typeof attributes === "object" && attributes != null
        ? (attributes as { decision?: { token_count?: unknown } }).decision
            ?.token_count
        : undefined;
    if (typeof tokenCount !== "object" || tokenCount == null) return null;
    const { input, output } = tokenCount as {
      input?: unknown;
      output?: unknown;
    };
    const asCount = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : null;
    const counts = { input: asCount(input), output: asCount(output) };
    return counts.input == null && counts.output == null ? null : counts;
  } catch {
    return null;
  }
}

/**
 * Tokens for a decision span, read from its usage attributes. Decision usage
 * is not folded into the LLM token and cost columns yet, so there is no
 * breakdown query to load and no cost to show.
 */
function DecisionTokenCount({
  attributesJSON,
}: {
  attributesJSON: string | null | undefined;
}) {
  const counts = getDecisionTokenCounts(attributesJSON);
  if (!counts) return null;
  const total = (counts.input ?? 0) + (counts.output ?? 0);
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCount size="S" role="button" tabIndex={0}>
          {total}
        </TokenCount>
      </Pressable>
      <RichTooltip placement="end">
        <TooltipArrow />
        <TokenDetailsBreakdown
          tokens={{
            total,
            prompt: counts.input,
            completion: counts.output,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  );
}

export function RunMetadataFooter({
  spanId,
  tokenSource = "span",
}: {
  spanId: string;
  /**
   * Where the token count comes from: the span's LLM token columns, or the
   * usage attributes a decision span records.
   */
  tokenSource?: TokenSource;
}) {
  const [, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<RunMetadataFooterQuery>(
    graphql`
      query RunMetadataFooterQuery($spanId: ID!) {
        span: node(id: $spanId) {
          id
          ... on Span {
            spanId
            trace {
              id
              traceId
              project {
                id
              }
            }
            tokenCountTotal
            latencyMs
            attributes
            costSummary {
              total {
                cost
              }
            }
          }
        }
      }
    `,
    { spanId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  if (!data.span || !data.span.trace || !data.span.trace.project) {
    return null;
  }
  const { trace } = data.span;
  const totalCost = data.span.costSummary?.total?.cost;

  return (
    <View
      borderTopColor="default"
      borderTopWidth="thin"
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-100"
      paddingBottom="size-100"
    >
      <Flex direction="row" gap="size-200" justifyContent="space-between">
        <Flex direction="row" gap="size-100" alignItems="center">
          <LatencyText size="S" latencyMs={data.span.latencyMs || 0} />
          {tokenSource === "decision" ? (
            <DecisionTokenCount attributesJSON={data.span.attributes} />
          ) : (
            <SpanTokenCount
              tokenCountTotal={data.span.tokenCountTotal || 0}
              nodeId={data.span.id}
              size="S"
            />
          )}
          {tokenSource === "span" && totalCost != null && (
            <SpanTokenCosts
              totalCost={totalCost}
              spanNodeId={data.span.id}
              size="S"
            />
          )}
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          <DialogTrigger>
            <Button size="S" leadingVisual={<Icon svg={<Icons.Edit />} />}>
              Annotate
            </Button>
            <ViewportModalOverlay>
              <ViewportModal size="S">
                <EditSpanAnnotationsDialog
                  spanNodeId={spanId}
                  projectId={trace.project.id}
                />
              </ViewportModal>
            </ViewportModalOverlay>
          </DialogTrigger>
          <DialogTrigger
            onOpenChange={(open) => {
              if (!open) {
                setSearchParams((searchParams) => {
                  searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                  return searchParams;
                });
              }
            }}
          >
            <Button size="S" leadingVisual={<Icon svg={<Icons.Trace />} />}>
              View Trace
            </Button>
            <ViewportModalOverlay>
              <ViewportModal size="fullscreen">
                <Suspense fallback={<Loading />}>
                  <PlaygroundRunTraceDetailsDialog
                    traceId={trace.traceId}
                    projectId={trace.project.id}
                    title={`Playground Trace`}
                  />
                </Suspense>
              </ViewportModal>
            </ViewportModalOverlay>
          </DialogTrigger>
        </Flex>
      </Flex>
    </View>
  );
}
