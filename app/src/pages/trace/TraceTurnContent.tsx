import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";
import isNumber from "lodash/isNumber";
import isString from "lodash/isString";
import type { MouseEvent, PropsWithChildren, ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import { ExpandableContent, Flex, Text, View } from "@phoenix/components";
import { promptInputSurfaceCSS } from "@phoenix/components/ai/prompt-input";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { TraceDetailPanelAnnotationButton } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { TraceAnnotationSummaryGroupTokens } from "@phoenix/components/annotation/TraceAnnotationSummaryGroup";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanCumulativeTokenCount } from "@phoenix/components/trace/SpanCumulativeTokenCount";
import { TraceTokenCosts } from "@phoenix/components/trace/TraceTokenCosts";
import { useTimeFormatters } from "@phoenix/hooks";
import type {
  TraceTurnContent_rootSpan$data,
  TraceTurnContent_rootSpan$key,
} from "@phoenix/pages/trace/__generated__/TraceTurnContent_rootSpan.graphql";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { TraceFeedbackActionToolbar } from "./TraceFeedbackActionToolbar";

const messageWrapCSS = css`
  width: fit-content;
  max-width: 80%;
`;

const traceTurnContentCSS = css`
  gap: var(--global-grid-gutter-xsmall);
`;

const traceTurnNavigationSurfaceCSS = css`
  width: 100%;
`;

const rootSpanMessageContainerCSS = css`
  width: 100%;
`;

const rootSpanMessageCSS = css`
  box-sizing: border-box;
  overflow: hidden;
  width: 100%;
  padding: var(--global-dimension-size-200);
  background-color: var(--global-background-color-default);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const outputMetadataMutedCSS = css`
  .latency-text,
  .token-count-item,
  .token-costs-item,
  .text,
  .icon-wrap,
  svg,
  .token__text {
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }
`;

const TRACE_TURN_MAX_WIDTH = "1000px";

export type RootSpanMessageRole = "INPUT" | "OUTPUT";

function isNestedInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button,a,input,select,textarea,[role="button"]') != null
  );
}

export function TraceTurnNavigationSurface({
  children,
  onMessageDoubleClick,
}: PropsWithChildren<{
  onMessageDoubleClick?: (role: RootSpanMessageRole) => void;
}>) {
  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isNestedInteractiveTarget(event.target)) {
      return;
    }
    event.stopPropagation();
    onMessageDoubleClick?.("INPUT");
  };

  return (
    <div
      className="trace-turn-content__navigation-surface"
      css={traceTurnNavigationSurfaceCSS}
      title={
        onMessageDoubleClick
          ? "Double-click to view this input in the trace"
          : undefined
      }
      onDoubleClick={onMessageDoubleClick ? handleDoubleClick : undefined}
    >
      {children}
    </div>
  );
}

type RootSpanMessageProps = {
  label?: string;
  onDoubleClick?: () => void;
  role: RootSpanMessageRole;
  value: unknown;
};

/** Presentational trace message bubble used by turn views and Storybook. */
export function RootSpanMessage({
  label,
  onDoubleClick,
  role,
  value,
}: RootSpanMessageProps) {
  const isInput = role === "INPUT";
  const defaultLabel = isInput ? "INPUT" : "OUTPUT";
  const overlayBackgroundColor = isInput
    ? "var(--prompt-input-background-color)"
    : "var(--global-background-color-default)";
  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isNestedInteractiveTarget(event.target)) {
      return;
    }
    event.stopPropagation();
    onDoubleClick?.();
  };
  return (
    <div
      className="root-span-message"
      css={rootSpanMessageContainerCSS}
      title={
        onDoubleClick
          ? `Double-click to view this ${defaultLabel.toLowerCase()} in the trace`
          : undefined
      }
      onDoubleClick={onDoubleClick ? handleDoubleClick : undefined}
    >
      <Flex
        direction="column"
        gap="size-50"
        alignItems={isInput ? "start" : "end"}
        width="100%"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
        >
          <Text color="text-700">{label ?? defaultLabel}</Text>
        </Flex>
        <div
          className="root-span-message__content"
          css={[
            rootSpanMessageCSS,
            isInput ? promptInputSurfaceCSS : undefined,
          ]}
        >
          <ExpandableContent
            height="lg"
            expandedBehavior="grow"
            overlayBackgroundColor={overlayBackgroundColor}
          >
            <DynamicContent value={value} />
          </ExpandableContent>
        </div>
      </Flex>
    </div>
  );
}

type RootSpan = TraceTurnContent_rootSpan$data;

function getUserFromRootSpanAttributes(attributes: string) {
  const { json: parsedAttributes } = safelyParseJSON(attributes);
  if (parsedAttributes == null || !isStringKeyedObject(parsedAttributes)) {
    return null;
  }
  const userAttributes = parsedAttributes[SemanticAttributePrefixes.user];
  if (userAttributes == null || !isStringKeyedObject(userAttributes)) {
    return null;
  }
  const userId = userAttributes[UserAttributePostfixes.id];
  return isString(userId) || isNumber(userId) ? userId : null;
}

function RootSpanStartTime({ rootSpan }: { rootSpan: RootSpan }) {
  const { fullTimeFormatter } = useTimeFormatters();
  return (
    <Text color="text-700" size="XS">
      {fullTimeFormatter(new Date(rootSpan.startTime))}
    </Text>
  );
}

function RootSpanEndTime({ rootSpan }: { rootSpan: RootSpan }) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (rootSpan.endTime == null) {
    return null;
  }
  return (
    <Text color="text-700" size="XS">
      {fullTimeFormatter(new Date(rootSpan.endTime))}
    </Text>
  );
}

function RootSpanOutputMetadata({ rootSpan }: { rootSpan: RootSpan }) {
  return (
    <>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="start"
        gap="size-200"
        width="100%"
      >
        <RootSpanEndTime rootSpan={rootSpan} />
        <Flex direction="column" alignItems="end" gap="size-100" minWidth={0}>
          <Flex
            direction="row"
            justifyContent="end"
            alignItems="center"
            gap="size-100"
            wrap
            css={outputMetadataMutedCSS}
          >
            <SpanCumulativeTokenCount
              tokenCountTotal={rootSpan.cumulativeTokenCountTotal || 0}
              nodeId={rootSpan.id}
            />
            {rootSpan.trace.costSummary?.total?.cost != null ? (
              <TraceTokenCosts
                totalCost={rootSpan.trace.costSummary.total.cost}
                nodeId={rootSpan.trace.id}
              />
            ) : null}
            {rootSpan.latencyMs != null ? (
              <LatencyText latencyMs={rootSpan.latencyMs} />
            ) : null}
          </Flex>
          <TraceFeedbackActionToolbar
            trace={rootSpan.trace}
            annotationAction={
              <TraceDetailPanelAnnotationButton
                traceNodeId={rootSpan.trace.id}
              />
            }
          />
        </Flex>
      </Flex>
      <div
        css={css`
          align-self: start;
        `}
      >
        <Flex direction="row" gap="size-50" wrap="wrap">
          <TraceAnnotationSummaryGroupTokens
            trace={rootSpan.trace}
            renderEmptyState={() => null}
          />
          <AnnotationSummaryGroupTokens
            span={rootSpan}
            renderEmptyState={() => null}
          />
        </Flex>
      </div>
    </>
  );
}

/** Shared input/output presentation for a trace's root span. */
export function TraceTurnContent({
  header,
  onMessageDoubleClick,
  rootSpan: rootSpanKey,
}: {
  header?: ReactNode;
  onMessageDoubleClick?: (role: RootSpanMessageRole) => void;
  rootSpan: TraceTurnContent_rootSpan$key;
}) {
  const rootSpan = useFragment<TraceTurnContent_rootSpan$key>(
    graphql`
      fragment TraceTurnContent_rootSpan on Span {
        id
        attributes
        project {
          id
        }
        input {
          value
        }
        output {
          value
        }
        cumulativeTokenCountTotal
        latencyMs
        startTime
        endTime
        trace {
          id
          costSummary {
            total {
              cost
            }
          }
          ...TraceAnnotationSummaryGroup
          ...TraceFeedbackActionToolbar_trace
        }
        ...AnnotationSummaryGroup
      }
    `,
    rootSpanKey
  );
  const user = getUserFromRootSpanAttributes(rootSpan.attributes);
  const inputLabel = user != null ? `USER: ${user}` : "INPUT";

  return (
    <TraceTurnNavigationSurface onMessageDoubleClick={onMessageDoubleClick}>
      <View width="100%" maxWidth={TRACE_TURN_MAX_WIDTH} marginX="auto">
        <Flex direction="column" css={traceTurnContentCSS}>
          {header}
          <Flex
            direction="column"
            gap="size-100"
            alignSelf="start"
            alignItems="start"
            css={messageWrapCSS}
          >
            <RootSpanMessage
              label={inputLabel}
              role="INPUT"
              value={rootSpan.input?.value}
            />
            <RootSpanStartTime rootSpan={rootSpan} />
          </Flex>
          <Flex
            direction="column"
            gap="size-100"
            alignSelf="end"
            alignItems="end"
            css={messageWrapCSS}
          >
            <RootSpanMessage
              onDoubleClick={
                onMessageDoubleClick
                  ? () => onMessageDoubleClick("OUTPUT")
                  : undefined
              }
              role="OUTPUT"
              value={rootSpan.output?.value}
            />
            <RootSpanOutputMetadata rootSpan={rootSpan} />
          </Flex>
        </Flex>
      </View>
    </TraceTurnNavigationSurface>
  );
}
