import { css } from "@emotion/react";
import { animate, useReducedMotion } from "motion/react";
import type {
  MouseEvent as ReactMouseEvent,
  PropsWithChildren,
  ReactNode,
} from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";

import {
  Button,
  Counter,
  ErrorBoundary,
  Flex,
  Loading,
} from "@phoenix/components";
import {
  SpanDetailPanelAnnotationBar,
  useSpanDetailPanelAnnotationBarQuery,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import { SPAN_DETAILS_CONDENSED_WIDTH_PIXELS } from "@phoenix/constants";
import { useDimensions } from "@phoenix/hooks";

import { DetailHeader } from "../DetailHeader";
import { SpanHeader } from "../SpanHeader";
import type { SpanDetailsContentQuery } from "./__generated__/SpanDetailsContentQuery.graphql";
import type { SpanDetailsHeaderQuery } from "./__generated__/SpanDetailsHeaderQuery.graphql";
import { DeferredSpanDetailsContent } from "./DeferredSpanDetailsContent";
import {
  DetailHeaderAnnotationBar,
  type DetailHeaderAnnotationTarget,
  DetailHeaderAnnotationTargetSelect,
} from "./DetailHeaderAnnotationTarget";
import {
  getSpanInfoSectionKeys,
  parseSpanAttributes,
  SpanAttributesSection,
  SpanInfo,
  type SpanInfoSectionIds,
  type SpanInfoSectionKey,
} from "./span";
import { SpanDetailsHeaderActions } from "./SpanDetailsHeaderActions";
import { SpanDetailsSectionHeading } from "./SpanDetailsSectionHeading";
import { SpanEventsList } from "./SpanEventsList";
import { useSpanInfoCardProps } from "./SpanInfoCardsContext";
import { SpanInfoCardsToggle } from "./SpanInfoCardsToggle";
import { useOptionalOpenSpanNoteBar } from "./SpanNoteBarContext";
import { SpanNotesList } from "./SpanNotesList";
import {
  DetailPanelAnnotationBarSkeleton,
  SpanDetailsContentSkeleton,
  SpanHeaderSkeleton,
} from "./TraceDetailsSkeleton";

const FINAL_SCROLL_ANIMATION_DISTANCE_PIXELS = 80;
const FINAL_SCROLL_ANIMATION_DURATION_SECONDS = 0.18;
const SECTION_FEEDBACK_ANIMATION_DURATION_SECONDS = 0.5;
const ATTRIBUTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS = 280;
const EVENTS_SECTION_PLACEHOLDER_HEIGHT_PIXELS = 240;
const NOTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS = 240;

const spanInfoSectionNavigationLabels: Record<SpanInfoSectionKey, string> = {
  input: "Input",
  output: "Output",
  toolDefinitions: "Tools",
  metadata: "Metadata",
};

const spanDetailsAnchorNavCSS = css`
  display: flex;
  align-items: center;
  flex: none;
  border-bottom: 1px solid var(--global-border-color-default);

  ul {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    list-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  li {
    flex: none;
  }

  a {
    display: flex;
    position: relative;
    align-items: center;
    gap: var(--global-dimension-size-100);
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

  & > button {
    flex: none;
    margin-right: var(--global-dimension-size-100);
  }
`;

const spanDetailsSectionsCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;

  & > [data-span-details-sections-content] {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  [data-span-details-notes] {
    margin-top: auto;
  }
`;

export function SpanDetails({
  spanNodeId,
  spanPreview,
  initialIsCondensedView = true,
  showSessionHeader = true,
  showTraceHeader = true,
}: {
  spanNodeId: string;
  spanPreview?: SpanDetailsPreview;
  initialIsCondensedView?: boolean;
  showSessionHeader?: boolean;
  showTraceHeader?: boolean;
}) {
  const { projectId } = useParams();
  const spanDetailsContainerRef = useRef<HTMLDivElement>(null);
  const spanDetailsContainerDimensions = useDimensions(spanDetailsContainerRef);
  const isCondensedView = spanDetailsContainerDimensions?.width
    ? spanDetailsContainerDimensions.width < SPAN_DETAILS_CONDENSED_WIDTH_PIXELS
    : initialIsCondensedView;
  const { queryRef: spanAnnotationQueryRef, refresh: refreshSpanAnnotations } =
    useSpanDetailPanelAnnotationBarQuery(spanNodeId);
  const selectedSpanAnnotationBar = spanAnnotationQueryRef ? (
    <SpanDetailPanelAnnotationBar
      queryRef={spanAnnotationQueryRef}
      refresh={refreshSpanAnnotations}
    />
  ) : (
    <DetailPanelAnnotationBarSkeleton variant="detail-header" />
  );

  if (projectId == null) {
    throw new Error("Project ID is required to download a span");
  }

  return (
    <Flex
      data-span-details-mounted-id={spanNodeId}
      direction="column"
      flex="1 1 auto"
      height="100%"
      ref={spanDetailsContainerRef}
    >
      <Suspense
        fallback={
          <SpanHeaderSkeleton
            annotationBar={
              <DetailPanelAnnotationBarSkeleton variant="detail-header" />
            }
            spanPreview={spanPreview}
            isCondensedView={isCondensedView}
          />
        }
      >
        <SpanDetailsHeader
          isCondensedView={isCondensedView}
          projectId={projectId}
          showSessionTarget={showSessionHeader}
          showTraceTarget={showTraceHeader}
          selectedSpanAnnotationBar={selectedSpanAnnotationBar}
          spanNodeId={spanNodeId}
        />
      </Suspense>
      <Suspense fallback={<SpanDetailsContentSkeleton />}>
        <SpanDetailsContent spanNodeId={spanNodeId} />
      </Suspense>
    </Flex>
  );
}

function SpanDetailsHeader({
  isCondensedView,
  projectId,
  selectedSpanAnnotationBar,
  showSessionTarget,
  showTraceTarget,
  spanNodeId,
}: {
  isCondensedView: boolean;
  projectId: string;
  selectedSpanAnnotationBar: ReactNode;
  showSessionTarget: boolean;
  showTraceTarget: boolean;
  spanNodeId: string;
}) {
  const { span } = useLazyLoadQuery<SpanDetailsHeaderQuery>(
    graphql`
      query SpanDetailsHeaderQuery($id: ID!, $includeSession: Boolean!) {
        span: node(id: $id) {
          __typename
          ... on Span {
            id
            name
            spanId
            parentId
            trace {
              id
              traceId
              spans(first: 1000) {
                edges {
                  node {
                    id
                    name
                    spanId
                    parentId
                  }
                }
              }
              session @include(if: $includeSession) {
                id
              }
            }
            spanKind
            ...SpanHeader_span
          }
        }
      }
    `,
    { id: spanNodeId, includeSession: showSessionTarget }
  );

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  const annotationTargets = getSpanAnnotationTargets({
    currentSpan: span,
    showSessionTarget,
    showTraceTarget,
  });
  const [selectedTargetId, setSelectedTargetId] = useState(span.id);
  const selectedTarget =
    annotationTargets.find((target) => target.id === selectedTargetId) ??
    annotationTargets[0];

  return (
    <DetailHeader
      annotationBar={
        <DetailHeaderAnnotationBar
          selectedSpanAnnotationBar={
            selectedTarget.id === span.id
              ? selectedSpanAnnotationBar
              : undefined
          }
          target={selectedTarget}
        />
      }
    >
      <div data-span-details-header-id={span.id} data-testid="span-header-row">
        <SpanHeader
          span={span}
          metadataAction={
            <DetailHeaderAnnotationTargetSelect
              targets={annotationTargets}
              selectedTarget={selectedTarget}
              onTargetChange={setSelectedTargetId}
            />
          }
          actions={
            <SpanDetailsHeaderActions
              buttonText={{
                addToDataset: isCondensedView ? null : "Add to Dataset",
                download: isCondensedView ? null : "Download",
                playground: isCondensedView ? null : "Playground",
              }}
              projectId={projectId}
              spanId={span.spanId}
              spanKind={span.spanKind}
              spanNodeId={span.id}
              traceId={span.trace.traceId}
            />
          }
        />
      </div>
    </DetailHeader>
  );
}

type SpanAnnotationTargetSource = {
  id: string;
  name: string;
  parentId: string | null;
  spanId: string;
};

function getSpanAnnotationTargets({
  currentSpan,
  showSessionTarget,
  showTraceTarget,
}: {
  currentSpan: SpanAnnotationTargetSource & {
    trace: {
      id: string;
      session?: { id: string } | null;
      traceId: string;
      spans: {
        edges: readonly { node: SpanAnnotationTargetSource }[];
      };
    };
  };
  showSessionTarget: boolean;
  showTraceTarget: boolean;
}): DetailHeaderAnnotationTarget[] {
  const targets: DetailHeaderAnnotationTarget[] = [
    { id: currentSpan.id, kind: "span", label: currentSpan.name },
  ];
  const spansByDisplayId = new Map(
    currentSpan.trace.spans.edges.map(({ node }) => [node.spanId, node])
  );
  const visitedSpanIds = new Set([currentSpan.spanId]);
  let parentId = currentSpan.parentId;

  while (parentId != null && !visitedSpanIds.has(parentId)) {
    visitedSpanIds.add(parentId);
    const parentSpan = spansByDisplayId.get(parentId);
    if (parentSpan == null) {
      break;
    }
    targets.push({
      id: parentSpan.id,
      kind: "span",
      label: parentSpan.name,
    });
    parentId = parentSpan.parentId;
  }

  if (showTraceTarget) {
    targets.push({
      id: currentSpan.trace.id,
      kind: "trace",
      label: "Trace",
    });
  }
  if (showSessionTarget && currentSpan.trace.session != null) {
    targets.push({
      id: currentSpan.trace.session.id,
      kind: "session",
      label: "Session",
    });
  }
  return targets;
}

function SpanDetailsContent({ spanNodeId }: { spanNodeId: string }) {
  const attributesDisclosureProps = useSpanInfoCardProps("attributes");
  const openSpanNoteBar = useOptionalOpenSpanNoteBar();
  const shouldReduceMotion = useReducedMotion();
  const spanDetailsSectionsRef = useRef<HTMLDivElement>(null);
  const spanDetailsSectionsContentRef = useRef<HTMLDivElement>(null);
  const spanDetailsMainRef = useRef<HTMLDivElement>(null);
  const notesHeadingRef = useRef<HTMLDivElement>(null);
  const spanDetailsSectionsDimensions = useDimensions(spanDetailsSectionsRef);
  const spanDetailsMainDimensions = useDimensions(spanDetailsMainRef);
  const notesHeadingDimensions = useDimensions(notesHeadingRef);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const sectionFeedbackAnimationRef = useRef<ReturnType<typeof animate> | null>(
    null
  );
  const sectionFeedbackElementRef = useRef<HTMLElement | null>(null);
  const { span } = useLazyLoadQuery<SpanDetailsContentQuery>(
    graphql`
      query SpanDetailsContentQuery($id: ID!) {
        span: node(id: $id) {
          __typename
          ... on Span {
            id
            spanId
            spanKind
            input {
              value
              mimeType
            }
            output {
              value
              mimeType
            }
            attributes
            events @required(action: THROW) {
              name
            }
            spanNotes {
              id
            }
            documentRetrievalMetrics {
              evaluationName
              ndcg
              precision
              hit
            }
            documentEvaluations {
              id
              annotatorKind
              documentPosition
              name
              label
              score
              explanation
              createdAt
              updatedAt
              user {
                username
                profilePictureUrl
              }
            }
          }
        }
      }
    `,
    { id: spanNodeId }
  );

  useEffect(() => {
    const scrollContent = spanDetailsSectionsContentRef.current;
    return () => {
      scrollAnimationRef.current?.stop();
      sectionFeedbackAnimationRef.current?.stop();
      if (scrollContent) {
        scrollContent.style.transform = "";
      }
    };
  }, []);

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  const hasExceptions = span.events.some((event) => event.name === "exception");
  const isNotesPushedBelowViewport =
    spanDetailsSectionsDimensions != null &&
    spanDetailsMainDimensions != null &&
    notesHeadingDimensions != null &&
    spanDetailsMainDimensions.height + notesHeadingDimensions.height >
      spanDetailsSectionsDimensions.height;
  const shouldRenderNotesContent =
    span.spanNotes.length > 0 || isNotesPushedBelowViewport;
  const spanInfoSectionIds: SpanInfoSectionIds = {
    input: `span-details-${span.spanId}-input`,
    output: `span-details-${span.spanId}-output`,
    toolDefinitions: `span-details-${span.spanId}-tool-definitions`,
    metadata: `span-details-${span.spanId}-metadata`,
  };
  const spanInfoSectionKeys = getSpanInfoSectionKeys({
    span,
    spanAttributes: parseSpanAttributes(span.attributes).json,
  });
  const spanDetailsSectionIds = {
    attributes: `span-details-${span.spanId}-attributes`,
    events: `span-details-${span.spanId}-events`,
    notes: `span-details-${span.spanId}-notes`,
  } as const;

  const showSectionNavigationFeedback = (targetSection: HTMLElement) => {
    const sectionFeedbackElement = targetSection.querySelector<HTMLElement>(
      "[data-section-navigation-feedback]"
    );
    if (!sectionFeedbackElement) {
      return;
    }

    sectionFeedbackAnimationRef.current?.stop();
    if (sectionFeedbackElementRef.current) {
      sectionFeedbackElementRef.current.style.opacity = "";
    }
    sectionFeedbackElementRef.current = sectionFeedbackElement;
    sectionFeedbackAnimationRef.current = animate(
      sectionFeedbackElement,
      { opacity: [0, 1, 1, 0] },
      {
        duration: SECTION_FEEDBACK_ANIMATION_DURATION_SECONDS,
        ease: "easeInOut",
        times: [0, 0.15, 0.55, 1],
        onComplete: () => {
          sectionFeedbackElement.style.opacity = "";
          sectionFeedbackAnimationRef.current = null;
          sectionFeedbackElementRef.current = null;
        },
      }
    );
  };

  const handleSectionLinkClick = ({
    event,
    sectionId,
  }: {
    event: ReactMouseEvent<HTMLAnchorElement>;
    sectionId: string;
  }) => {
    const isModifiedClick =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;
    if (isModifiedClick) {
      return;
    }

    const scrollContainer = spanDetailsSectionsRef.current;
    const scrollContent = spanDetailsSectionsContentRef.current;
    const targetSection = document.getElementById(sectionId);
    if (
      !scrollContainer ||
      !scrollContent ||
      !targetSection ||
      !scrollContainer.contains(targetSection)
    ) {
      return;
    }

    event.preventDefault();
    window.history.replaceState(
      window.history.state,
      "",
      event.currentTarget.hash
    );

    scrollAnimationRef.current?.stop();
    scrollAnimationRef.current = null;
    scrollContent.style.transform = "";
    sectionFeedbackAnimationRef.current?.stop();
    sectionFeedbackAnimationRef.current = null;
    if (sectionFeedbackElementRef.current) {
      sectionFeedbackElementRef.current.style.opacity = "";
      sectionFeedbackElementRef.current = null;
    }

    const currentScrollTop = scrollContainer.scrollTop;
    const maximumScrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetScrollTop = Math.min(
      Math.max(
        currentScrollTop +
          targetSection.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top,
        0
      ),
      maximumScrollTop
    );
    const scrollDistance = targetScrollTop - currentScrollTop;
    const hasFullAnimationDistance =
      Math.abs(scrollDistance) > FINAL_SCROLL_ANIMATION_DISTANCE_PIXELS;
    scrollContainer.scrollTop = targetScrollTop;

    if (!hasFullAnimationDistance || shouldReduceMotion) {
      showSectionNavigationFeedback(targetSection);
      return;
    }

    const scrollDirection = Math.sign(scrollDistance);
    const initialContentTransform = `translateY(${scrollDirection * FINAL_SCROLL_ANIMATION_DISTANCE_PIXELS}px)`;
    scrollContent.style.transform = initialContentTransform;
    scrollAnimationRef.current = animate(
      scrollContent,
      { transform: [initialContentTransform, "translateY(0px)"] },
      {
        type: "tween",
        duration: FINAL_SCROLL_ANIMATION_DURATION_SECONDS,
        ease: "easeOut",
        onComplete: () => {
          scrollContent.style.transform = "";
          scrollAnimationRef.current = null;
          showSectionNavigationFeedback(targetSection);
        },
      }
    );
  };

  return (
    <Flex
      data-span-details-body-id={span.id}
      direction="column"
      flex="1 1 auto"
      minHeight={0}
    >
      <nav css={spanDetailsAnchorNavCSS} aria-label="Span detail sections">
        <ul>
          {spanInfoSectionKeys.map((sectionKey) => (
            <SpanDetailSectionLink
              key={sectionKey}
              label={spanInfoSectionNavigationLabels[sectionKey]}
              sectionId={spanInfoSectionIds[sectionKey]}
              onClick={handleSectionLinkClick}
            />
          ))}
          <SpanDetailSectionLink
            label="Attributes"
            sectionId={spanDetailsSectionIds.attributes}
            onClick={handleSectionLinkClick}
          />
          <SpanDetailSectionLink
            label="Events"
            sectionId={spanDetailsSectionIds.events}
            onClick={handleSectionLinkClick}
          >
            <Counter variant={hasExceptions ? "danger" : "default"}>
              {span.events.length}
            </Counter>
          </SpanDetailSectionLink>
          <SpanDetailSectionLink
            label="Notes"
            sectionId={spanDetailsSectionIds.notes}
            onClick={handleSectionLinkClick}
          >
            <Counter>{span.spanNotes.length}</Counter>
          </SpanDetailSectionLink>
        </ul>
        <SpanInfoCardsToggle />
      </nav>
      <div ref={spanDetailsSectionsRef} css={spanDetailsSectionsCSS}>
        <div
          ref={spanDetailsSectionsContentRef}
          data-span-details-sections-content
        >
          <div ref={spanDetailsMainRef} data-span-details-main>
            <ErrorBoundary>
              <SpanInfo span={span} sectionIds={spanInfoSectionIds} />
            </ErrorBoundary>
            <section
              id={spanDetailsSectionIds.attributes}
              aria-label="Attributes"
            >
              <DeferredSpanDetailsContent
                fallback={
                  <SpanDetailsSectionHeading
                    bordered={spanInfoSectionKeys.length > 0}
                  >
                    Attributes
                  </SpanDetailsSectionHeading>
                }
                observeAfterFallback
                placeholderHeight={ATTRIBUTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS}
              >
                <SpanAttributesSection
                  attributes={span.attributes}
                  bordered={spanInfoSectionKeys.length > 0}
                  {...attributesDisclosureProps}
                />
              </DeferredSpanDetailsContent>
            </section>
            <section id={spanDetailsSectionIds.events} aria-label="Events">
              <SpanDetailsSectionHeading>
                <Flex
                  elementType="span"
                  direction="row"
                  gap="size-100"
                  alignItems="center"
                >
                  Events
                  <Counter variant={hasExceptions ? "danger" : "default"}>
                    {span.events.length}
                  </Counter>
                </Flex>
              </SpanDetailsSectionHeading>
              <DeferredSpanDetailsContent
                placeholderHeight={EVENTS_SECTION_PLACEHOLDER_HEIGHT_PIXELS}
              >
                <Suspense fallback={<Loading />}>
                  <SpanEventsList spanId={span.id} />
                </Suspense>
              </DeferredSpanDetailsContent>
            </section>
          </div>
          <section
            id={spanDetailsSectionIds.notes}
            aria-label="Notes"
            data-span-details-notes
          >
            <SpanDetailsSectionHeading
              ref={notesHeadingRef}
              extra={
                openSpanNoteBar ? (
                  <Button size="S" variant="quiet" onPress={openSpanNoteBar}>
                    Take notes
                  </Button>
                ) : null
              }
            >
              <Flex
                elementType="span"
                direction="row"
                gap="size-100"
                alignItems="center"
              >
                Notes
                <Counter>{span.spanNotes.length}</Counter>
              </Flex>
            </SpanDetailsSectionHeading>
            {shouldRenderNotesContent ? (
              <DeferredSpanDetailsContent
                placeholderHeight={NOTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS}
              >
                <Suspense fallback={<Loading />}>
                  <SpanNotesList spanId={span.id} />
                </Suspense>
              </DeferredSpanDetailsContent>
            ) : null}
          </section>
        </div>
      </div>
    </Flex>
  );
}

function SpanDetailSectionLink({
  label,
  sectionId,
  onClick,
  children,
}: PropsWithChildren<{
  label: string;
  sectionId: string;
  onClick: (params: {
    event: ReactMouseEvent<HTMLAnchorElement>;
    sectionId: string;
  }) => void;
}>) {
  return (
    <li>
      <a
        href={`#${sectionId}`}
        onClick={(event) => onClick({ event, sectionId })}
      >
        {label}
        {children}
      </a>
    </li>
  );
}
