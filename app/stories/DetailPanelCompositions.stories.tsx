import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useReducedMotion } from "motion/react";
import type {
  MouseEvent as ReactMouseEvent,
  PropsWithChildren,
  ReactNode,
} from "react";
import { useId, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import {
  Button,
  DisclosureArrow,
  Flex,
  Icon,
  Icons,
  Text,
  TitleWithID,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import {
  TraceTree,
  type TraceTreeProps,
  TraceTreeProvider,
} from "@phoenix/components/trace/TraceTree";
import { traceTreePanelContentCSS } from "@phoenix/components/trace/traceTreeStyles";
import { TraceTreeToolbar } from "@phoenix/components/trace/TraceTreeToolbar";
import type { ISpanItem } from "@phoenix/components/trace/types";
import {
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_TREE_DEFAULT_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";
import type { SpanHeaderData } from "@phoenix/pages/SpanHeader";
import { SpanHeaderContent } from "@phoenix/pages/SpanHeader";
import { AnnotationsEmpty } from "@phoenix/pages/trace/AnnotationsEmpty";
import { RootSpanMessage } from "@phoenix/pages/trace/SessionDetailsTraceList";
import type { SessionView } from "@phoenix/pages/trace/SessionViewTabs";
import { SessionViewTabs } from "@phoenix/pages/trace/SessionViewTabs";
import type {
  SpanInfoData,
  SpanInfoSectionIds,
  SpanInfoSectionKey,
} from "@phoenix/pages/trace/span";
import {
  getSpanInfoSectionKeys,
  parseSpanAttributes,
  SpanAttributesSection,
  SpanInfo,
} from "@phoenix/pages/trace/span";
import { SpanEventsListContent } from "@phoenix/pages/trace/SpanEventsList";
import { SpanInfoCardsProvider } from "@phoenix/pages/trace/SpanInfoCardsContext";
import { SpanNotesListContent } from "@phoenix/pages/trace/SpanNotesList";
import type { TraceHeaderCostSummary } from "@phoenix/pages/trace/TraceDetails";
import { TraceHeaderContent } from "@phoenix/pages/trace/TraceDetails";

import {
  createSpanInfoFixture,
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const panelFrameCSS = css`
  width: 100%;
  height: 620px;
  min-width: 0;
  overflow: hidden;
  background: var(--global-background-color-default);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
`;

const spanInfoSectionNavigationLabels: Record<SpanInfoSectionKey, string> = {
  input: "Input",
  output: "Output",
  toolDefinitions: "Tools",
  metadata: "Metadata",
};

const compositionBodyCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
`;

const spanSectionNavigationCSS = css`
  display: flex;
  flex: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: none;
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  &::-webkit-scrollbar {
    display: none;
  }

  li {
    flex: none;
  }

  a {
    display: flex;
    position: relative;
    align-items: center;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    text-decoration: none;
    white-space: nowrap;
    outline: none;

    &:hover {
      color: var(--global-text-color-900);
      background: var(--global-color-primary-50);
    }

    &:focus-visible {
      color: var(--global-text-color-900);
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-offset));
    }
  }
`;

const spanDetailsContentCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

const sessionTraceRowCSS = css`
  display: flex;
  flex-direction: column;
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  &[data-selected="true"] > button {
    background: var(--global-list-item-selected-background-color);
    color: var(--global-text-color-900);
    border-left-color: var(--global-list-item-selected-border-color);
  }
`;

const sessionTraceRowHeaderCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-left: 4px solid transparent;
  box-sizing: border-box;

  &:hover {
    background: var(--global-list-item-hover-background-color);
  }
`;

const sessionTraceTreeCSS = css`
  max-height: 260px;
  overflow: auto;
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  background: var(--global-color-gray-75);
`;

const sessionTurnIndexCSS = css`
  height: 100%;
  overflow: auto;
  border-right: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

const turnIndexRowCSS = css`
  padding: var(--global-dimension-size-150);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  &[data-selected="true"] {
    background: var(--global-list-item-selected-background-color);
  }
`;

const turnDetailRowCSS = css`
  padding: var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  &[data-selected="true"] {
    background: var(--global-list-detail-selected-background-color);
  }
`;

const sessionMessageWrapCSS = css`
  width: fit-content;
  max-width: 78%;
`;

const ROOT_SPAN: SpanHeaderData = {
  code: "OK",
  costSummary: { total: { cost: 0.0123 } },
  id: "RootSpan-node-01",
  latencyMs: 1842,
  name: "Retrieve Kyoto hotel options",
  spanId: "RootSpan-7f51c3bce0c64a11",
  spanKind: "chain",
  startTime: "2026-07-23T16:00:00.000Z",
  statusMessage: "",
  tokenCountTotal: 1847,
};

const CHILD_SPAN: SpanHeaderData = {
  ...ROOT_SPAN,
  code: "ERROR",
  costSummary: { total: { cost: 0.0098 } },
  id: "NestedSpan-node-01",
  latencyMs: 1260,
  name: "Narrow hotel candidates",
  spanId: "NestedSpan-e61d97a3c5084fb2",
  spanKind: "llm",
  startTime: "2026-07-23T16:00:00.420Z",
  statusMessage: "The model provider rejected the request.",
  tokenCountTotal: 1320,
};

const TOOL_SPAN: SpanHeaderData = {
  ...ROOT_SPAN,
  costSummary: null,
  id: "NestedSpan-node-02",
  latencyMs: 410,
  name: "Navigate hotel catalog",
  spanId: "NestedSpan-13b7d9e5a2604cf8",
  spanKind: "tool",
  startTime: "2026-07-23T16:00:00.810Z",
  tokenCountTotal: null,
};

function createDetailSpan({
  header,
  overrides,
}: {
  header: SpanHeaderData;
  overrides?: Partial<SpanInfoData>;
}) {
  return createSpanInfoFixture({
    id: header.id,
    spanKind: header.spanKind,
    ...overrides,
  });
}

const ROOT_SPAN_DETAILS = createDetailSpan({
  header: ROOT_SPAN,
  overrides: {
    input: {
      mimeType: "text",
      value: "Find hotels near Gion with breakfast included.",
    },
    output: {
      mimeType: "text",
      value:
        "I found three well-rated hotels within walking distance of Gion that include breakfast.",
    },
    attributes: JSON.stringify({
      metadata: { environment: "production", region: "us-west-2" },
    }),
  },
});

const CHILD_SPAN_DETAILS = createDetailSpan({
  header: CHILD_SPAN,
  overrides: {
    input: {
      mimeType: "text",
      value: "Find hotels near Gion with breakfast included.",
    },
    output: {
      mimeType: "text",
      value:
        "Here are the top matches, ranked by walking distance, guest rating, and breakfast availability.",
    },
    attributes: JSON.stringify({
      llm: {
        provider: "openai",
        model_name: "gpt-4.1",
        invocation_parameters: JSON.stringify({
          temperature: 0.2,
          max_completion_tokens: 4096,
        }),
      },
      metadata: { environment: "production", region: "us-west-2" },
    }),
  },
});

const TOOL_SPAN_DETAILS = createDetailSpan({
  header: TOOL_SPAN,
  overrides: {
    input: {
      mimeType: "json",
      value: JSON.stringify(
        { neighborhood: "Gion", amenities: ["breakfast"] },
        null,
        2
      ),
    },
    output: {
      mimeType: "json",
      value: JSON.stringify(
        { resultCount: 3, source: "hotel-catalog" },
        null,
        2
      ),
    },
    attributes: JSON.stringify({
      tool: {
        name: "narrow_hotel_catalog",
        description: "Searches the hotel catalog for matching properties.",
        parameters: {
          type: "object",
          required: ["neighborhood", "amenities"],
        },
      },
    }),
  },
});

function createTreeSpan({
  header,
  endTime,
  parentId,
}: {
  header: SpanHeaderData;
  endTime: string;
  parentId: string | null;
}): ISpanItem {
  return {
    id: header.id,
    name: header.name,
    spanKind: header.spanKind,
    statusCode: header.code,
    latencyMs: header.latencyMs,
    startTime: header.startTime,
    endTime,
    parentId,
    spanId: header.spanId,
    tokenCountTotal: header.tokenCountTotal,
  };
}

const TRACE_TREE_SPANS: ISpanItem[] = [
  createTreeSpan({
    header: ROOT_SPAN,
    endTime: "2026-07-23T16:00:01.842Z",
    parentId: null,
  }),
  createTreeSpan({
    header: CHILD_SPAN,
    endTime: "2026-07-23T16:00:01.680Z",
    parentId: ROOT_SPAN.spanId,
  }),
  createTreeSpan({
    header: TOOL_SPAN,
    endTime: "2026-07-23T16:00:01.220Z",
    parentId: CHILD_SPAN.spanId,
  }),
];

const TRACE_COST_SUMMARY: TraceHeaderCostSummary = {
  prompt: { cost: 0.0082 },
  completion: { cost: 0.0041 },
  total: { cost: 0.0123 },
};

type SelectedSpan = "root" | "child" | "tool";

function DetailPanelFrame({
  title,
  id,
  hasShareAction = false,
  children,
}: PropsWithChildren<{
  title: "Trace" | "Session";
  id: string;
  hasShareAction?: boolean;
}>) {
  return (
    <div css={panelFrameCSS}>
      <DialogContent>
        <DialogHeader>
          <Flex direction="row" gap="size-200" alignItems="center">
            <Button
              size="S"
              aria-label={`Close ${title.toLowerCase()} details`}
              leadingVisual={<Icon svg={<Icons.ChevronRightDouble />} />}
            />
            <Flex direction="row" gap="size-50" alignItems="center">
              <Button
                size="S"
                aria-label={`Next ${title.toLowerCase()}`}
                leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
              />
              <Button
                size="S"
                aria-label={`Previous ${title.toLowerCase()}`}
                leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
              />
            </Flex>
            <DialogTitle>
              <TitleWithID title={title} id={id} />
            </DialogTitle>
          </Flex>
          {hasShareAction ? (
            <DialogTitleExtra>
              <Button size="S" leadingVisual={<Icon svg={<Icons.Share />} />}>
                Share
              </Button>
            </DialogTitleExtra>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </div>
  );
}

function TraceTreeFixture({
  selectedSpanNodeId,
  spans = TRACE_TREE_SPANS,
  hasToolbar = true,
  onSpanClick,
  session,
}: {
  selectedSpanNodeId: string;
  spans?: ISpanItem[];
  hasToolbar?: boolean;
  onSpanClick?: (span: ISpanItem) => void;
  session?: TraceTreeProps["session"];
}) {
  return (
    <TraceTreeProvider>
      <div css={traceTreePanelContentCSS}>
        {hasToolbar ? <TraceTreeToolbar /> : null}
        <TraceTree
          spans={spans}
          session={session}
          selectedSpanNodeId={selectedSpanNodeId}
          scrollSelectedSpanIntoView={false}
          onSpanClick={onSpanClick}
        />
      </div>
    </TraceTreeProvider>
  );
}

function SpanDetailsFixture({
  header,
  details,
}: {
  header: SpanHeaderData;
  details: SpanInfoData;
}) {
  const sectionIdPrefix = useId().replaceAll(":", "");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const spanInfoSectionIds: SpanInfoSectionIds = {
    input: `${sectionIdPrefix}-input`,
    output: `${sectionIdPrefix}-output`,
    toolDefinitions: `${sectionIdPrefix}-tool-definitions`,
    metadata: `${sectionIdPrefix}-metadata`,
  };
  const spanInfoSectionKeys = getSpanInfoSectionKeys({
    span: details,
    spanAttributes: parseSpanAttributes(details.attributes).json,
  });
  const sectionIds = {
    attributes: `${sectionIdPrefix}-attributes`,
    events: `${sectionIdPrefix}-events`,
    notes: `${sectionIdPrefix}-notes`,
  };
  const handleSectionLinkClick = ({
    event,
    sectionId,
  }: {
    event: ReactMouseEvent<HTMLAnchorElement>;
    sectionId: string;
  }) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const scrollContainer = scrollContainerRef.current;
    const targetSection = document.getElementById(sectionId);
    if (!scrollContainer || !targetSection) {
      return;
    }
    event.preventDefault();
    const maximumScrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetScrollTop = Math.min(
      Math.max(
        scrollContainer.scrollTop +
          targetSection.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top,
        0
      ),
      maximumScrollTop
    );
    scrollContainer.scrollTo({
      top: targetScrollTop,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };
  return (
    <SpanInfoCardsProvider>
      <div css={panelContentCSS}>
        <View
          paddingTop="size-100"
          paddingBottom="size-100"
          paddingStart="size-150"
          paddingEnd="size-200"
          flex="none"
        >
          <SpanHeaderContent span={header} />
        </View>
        <nav aria-label="Span detail sections">
          <ul css={spanSectionNavigationCSS}>
            {spanInfoSectionKeys.map((sectionKey) => (
              <li key={sectionKey}>
                <a
                  href={`#${spanInfoSectionIds[sectionKey]}`}
                  onClick={(event) =>
                    handleSectionLinkClick({
                      event,
                      sectionId: spanInfoSectionIds[sectionKey],
                    })
                  }
                >
                  {spanInfoSectionNavigationLabels[sectionKey]}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`#${sectionIds.attributes}`}
                onClick={(event) =>
                  handleSectionLinkClick({
                    event,
                    sectionId: sectionIds.attributes,
                  })
                }
              >
                Attributes
              </a>
            </li>
            <li>
              <a
                href={`#${sectionIds.events}`}
                onClick={(event) =>
                  handleSectionLinkClick({
                    event,
                    sectionId: sectionIds.events,
                  })
                }
              >
                Events
              </a>
            </li>
            <li>
              <a
                href={`#${sectionIds.notes}`}
                onClick={(event) =>
                  handleSectionLinkClick({
                    event,
                    sectionId: sectionIds.notes,
                  })
                }
              >
                Notes
              </a>
            </li>
          </ul>
        </nav>
        <div ref={scrollContainerRef} css={spanDetailsContentCSS}>
          <SpanInfo span={details} sectionIds={spanInfoSectionIds} />
          <section id={sectionIds.attributes} aria-label="Attributes">
            <SpanAttributesSection
              attributes={details.attributes}
              bordered={spanInfoSectionKeys.length > 0}
            />
          </section>
          <section id={sectionIds.events} aria-label="Events">
            <View padding="size-200">
              <Text elementType="h3" size="L" weight="heavy">
                Events
              </Text>
            </View>
            <SpanEventsListContent events={[]} />
          </section>
          <section id={sectionIds.notes} aria-label="Notes">
            <View padding="size-200">
              <Text elementType="h3" size="L" weight="heavy">
                Notes
              </Text>
            </View>
            <SpanNotesListContent notes={[]} />
          </section>
        </div>
      </div>
    </SpanInfoCardsProvider>
  );
}

function TracePanelComposition({
  selectedSpan,
}: {
  selectedSpan: SelectedSpan;
}) {
  const [activeSpan, setActiveSpan] = useState(selectedSpan);
  const header =
    activeSpan === "root"
      ? ROOT_SPAN
      : activeSpan === "child"
        ? CHILD_SPAN
        : TOOL_SPAN;
  const details =
    activeSpan === "root"
      ? ROOT_SPAN_DETAILS
      : activeSpan === "child"
        ? CHILD_SPAN_DETAILS
        : TOOL_SPAN_DETAILS;
  const selectedSpanNodeId =
    activeSpan === "root"
      ? ROOT_SPAN.id
      : activeSpan === "child"
        ? CHILD_SPAN.id
        : TOOL_SPAN.id;
  const getSelectedSpan = (spanNodeId: string): SelectedSpan =>
    spanNodeId === ROOT_SPAN.id
      ? "root"
      : spanNodeId === CHILD_SPAN.id
        ? "child"
        : "tool";
  return (
    <DetailPanelFrame
      title="Trace"
      id="Trace-34d790eb0d3341a68b61545d765a5ff0"
      hasShareAction
    >
      <TraceHeaderContent
        statusCode="OK"
        latencyMs={1842}
        costSummary={TRACE_COST_SUMMARY}
      />
      <Group orientation="horizontal" css={compositionBodyCSS}>
        <Panel
          id={`trace-tree-${selectedSpan}`}
          defaultSize={TRACE_TREE_DEFAULT_WIDTH_PIXELS}
          minSize={TRACE_TREE_MIN_WIDTH_PIXELS}
          groupResizeBehavior="preserve-pixel-size"
          css={css`
            container-type: inline-size;
          `}
          style={{ maxWidth: "none", overflow: "visible" }}
        >
          <TraceTreeFixture
            selectedSpanNodeId={selectedSpanNodeId}
            session={{
              sessionId: "support-chat-01J5QX8G6N4M2K7P",
              to: "/projects/project-storybook/sessions/storybook-session",
            }}
            onSpanClick={(span) => setActiveSpan(getSelectedSpan(span.id))}
          />
        </Panel>
        <Separator
          css={[
            compactResizeHandleCSS,
            css`
              position: relative;
              z-index: 3;
            `,
          ]}
        />
        <Panel
          id={`span-details-${selectedSpan}`}
          minSize={SPAN_DETAILS_MIN_WIDTH_PIXELS}
        >
          <SpanDetailsFixture header={header} details={details} />
        </Panel>
      </Group>
    </DetailPanelFrame>
  );
}

function SessionMetricsHeader() {
  return (
    <View
      padding="size-200"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <Flex direction="row" gap="size-400" alignItems="center" wrap>
        <Metric label="Total Tokens">8,492</Metric>
        <Metric label="Total Cost">$0.0842</Metric>
        <Metric label="Latency P50">1.36s</Metric>
      </Flex>
    </View>
  );
}

function Metric({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <Flex direction="column" gap="size-25">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      <Text size="L">{children}</Text>
    </Flex>
  );
}

const SESSION_TURNS = [
  { name: "Trip planning", time: "10:42:01" },
  { name: "Traveler hotel search", time: "10:42:05" },
  { name: "Top option comparison", time: "10:42:09" },
] as const;

function SessionTurnsFixture() {
  return (
    <Group orientation="horizontal" css={compositionBodyCSS}>
      <Panel id="session-turn-index" defaultSize="20%" minSize="10%">
        <div css={sessionTurnIndexCSS}>
          {SESSION_TURNS.map((turn, index) => (
            <div
              key={turn.name}
              css={turnIndexRowCSS}
              data-selected={index === 1 || undefined}
            >
              <Flex direction="column" gap="size-50">
                <Text size="XS" color="text-500" fontFamily="mono">
                  {String(index + 1).padStart(2, "0")} · {turn.time}
                </Text>
                <Text weight="heavy" size="S">
                  {turn.name}
                </Text>
              </Flex>
            </div>
          ))}
        </div>
      </Panel>
      <Separator css={compactResizeHandleCSS} />
      <Panel id="session-turn-details">
        <div css={spanDetailsContentCSS}>
          {SESSION_TURNS.map((turn, index) => (
            <div
              key={turn.name}
              css={turnDetailRowCSS}
              data-selected={index === 1 || undefined}
            >
              <Flex direction="column" gap="size-150">
                <Flex direction="row" justifyContent="space-between">
                  <Text weight="heavy">
                    Turn {String(index + 1).padStart(2, "0")}
                  </Text>
                  <Text size="XS" color="text-500">
                    {turn.time}
                  </Text>
                </Flex>
                <Flex
                  direction="column"
                  alignSelf="start"
                  alignItems="start"
                  css={sessionMessageWrapCSS}
                >
                  <RootSpanMessage
                    role="INPUT"
                    value={
                      index === 0
                        ? "Help me plan a short trip to Kyoto."
                        : index === 1
                          ? "Find hotels near Gion with breakfast included."
                          : "Compare the best two options."
                    }
                  />
                </Flex>
                <Flex
                  direction="column"
                  alignSelf="end"
                  alignItems="end"
                  css={sessionMessageWrapCSS}
                >
                  <RootSpanMessage
                    role="OUTPUT"
                    value="I found several options and summarized the relevant tradeoffs."
                  />
                </Flex>
              </Flex>
            </div>
          ))}
        </div>
      </Panel>
    </Group>
  );
}

type SessionTrace = {
  name: string;
  time: string;
  tokenCount: number;
  cost: number;
  latencyMs: number;
  isExpanded?: boolean;
  isSelected?: boolean;
};

const SESSION_TRACES: SessionTrace[] = [
  {
    name: "Request trip plan",
    time: "10:42:01",
    tokenCount: 1847,
    cost: 0.0123,
    latencyMs: 1842,
  },
  {
    name: "Retrieve hotel matches",
    time: "10:42:05",
    tokenCount: 3210,
    cost: 0.0412,
    latencyMs: 2870,
    isExpanded: true,
    isSelected: true,
  },
  {
    name: "Rank final options",
    time: "10:42:09",
    tokenCount: 3435,
    cost: 0.0307,
    latencyMs: 1640,
  },
];

function SessionTraceRow({
  trace,
  index,
}: {
  trace: SessionTrace;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(trace.isExpanded ?? false);
  return (
    <div css={sessionTraceRowCSS} data-selected={trace.isSelected || undefined}>
      <button
        type="button"
        css={sessionTraceRowHeaderCSS}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <DisclosureArrow isExpanded={isExpanded} />
        <Flex direction="column" gap="size-100" flex={1} minWidth={0}>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            <Flex direction="row" gap="size-100" alignItems="center">
              <Text fontFamily="mono" color="text-500">
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text weight="heavy">{trace.name}</Text>
            </Flex>
            <Text color="text-700" size="XS">
              {trace.time}
            </Text>
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center" wrap>
            <TokenCount size="S">{trace.tokenCount}</TokenCount>
            <TokenCosts size="S">{trace.cost}</TokenCosts>
            <LatencyText latencyMs={trace.latencyMs} size="S" />
          </Flex>
        </Flex>
      </button>
      {isExpanded ? (
        <div css={sessionTraceTreeCSS}>
          <TraceTreeFixture
            spans={TRACE_TREE_SPANS.slice(1)}
            selectedSpanNodeId={CHILD_SPAN.id}
            hasToolbar={false}
          />
        </div>
      ) : null}
    </div>
  );
}

function SessionTracesFixture() {
  return (
    <Group orientation="horizontal" css={compositionBodyCSS}>
      <Panel id="session-traces-list" defaultSize="50%" minSize="20%">
        <div css={spanDetailsContentCSS}>
          {SESSION_TRACES.map((trace, index) => (
            <SessionTraceRow key={trace.name} trace={trace} index={index} />
          ))}
        </div>
      </Panel>
      <Separator css={compactResizeHandleCSS} />
      <Panel id="session-selected-span">
        <SpanDetailsFixture header={CHILD_SPAN} details={CHILD_SPAN_DETAILS} />
      </Panel>
    </Group>
  );
}

function SessionPanelComposition({
  initialView,
}: {
  initialView: Exclude<SessionView, "annotations">;
}) {
  const [sessionView, setSessionView] = useState<SessionView>(initialView);
  let body: ReactNode;
  if (sessionView === "turns") {
    body = <SessionTurnsFixture />;
  } else if (sessionView === "traces") {
    body = <SessionTracesFixture />;
  } else {
    body = <AnnotationsEmpty description="No annotations for this session" />;
  }
  return (
    <DetailPanelFrame title="Session" id="Session-2026-07-23-Kyoto">
      <SessionMetricsHeader />
      <div css={compositionBodyCSS}>
        <SessionViewTabs
          sessionView={sessionView}
          onSessionViewChange={setSessionView}
          traceCount={SESSION_TRACES.length}
        >
          {body}
        </SessionViewTabs>
      </div>
    </DetailPanelFrame>
  );
}

function DetailPanelCompositions() {
  return (
    <DetailPanelExamples>
      <DetailPanelExample
        title="Session · Traces"
        description="The session shell with its expandable trace list and selected span details composition."
      >
        <SessionPanelComposition initialView="traces" />
      </DetailPanelExample>
      <DetailPanelExample
        title="Session · Turns"
        description="The session shell with its turn index and conversational turn details composition."
      >
        <SessionPanelComposition initialView="turns" />
      </DetailPanelExample>
      <DetailPanelExample
        title="Trace entry"
        description="The shared trace/span composition opened from the traces table, with the root span selected by default."
      >
        <TracePanelComposition selectedSpan="root" />
      </DetailPanelExample>
      <DetailPanelExample
        title="Nested span entry"
        description="The same composition opened from the spans table, with the requested nested span selected."
      >
        <TracePanelComposition selectedSpan="child" />
      </DetailPanelExample>
    </DetailPanelExamples>
  );
}

const meta = {
  title: "Detail panel/Compositions",
  component: DetailPanelCompositions,
  parameters: {
    width: "fill",
    themeLayout: "column",
    docs: {
      description: {
        component:
          "The four composition states used by the trace, span, and session detail drawers. Annotation side rails are intentionally excluded.",
      },
    },
  },
} satisfies Meta<typeof DetailPanelCompositions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {
  tags: ["!dev"],
};
