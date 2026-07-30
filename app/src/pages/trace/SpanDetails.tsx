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
  Icon,
  Icons,
  KeyboardToken,
  Loading,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import {
  SpanDetailPanelAnnotationBar,
  useSpanDetailPanelAnnotationBarQuery,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import {
  NOTE_HOTKEY,
  SPAN_DETAILS_CONDENSED_WIDTH_PIXELS,
} from "@phoenix/constants";
import { usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";

import { DetailHeader } from "../DetailHeader";
import { SpanHeader } from "../SpanHeader";
import type { SpanDetailsContentQuery } from "./__generated__/SpanDetailsContentQuery.graphql";
import type { SpanDetailsHeaderQuery } from "./__generated__/SpanDetailsHeaderQuery.graphql";
import { DeferredSpanDetailsContent } from "./DeferredSpanDetailsContent";
import {
  getExpectedSpanInfoSectionKeys,
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
import { SpanNoteBar } from "./SpanNoteBar";
import {
  useIsActiveSpanNoteBar,
  useOptionalOpenSpanNoteBar,
} from "./SpanNoteBarContext";
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

type SpanContentKey = SpanInfoSectionKey | "events";

const spanContentAbsenceLabels: Record<SpanContentKey, string> = {
  input: "input",
  output: "output",
  toolDefinitions: "tool definitions",
  metadata: "metadata",
  events: "events",
};

function formatSpanContentAbsence(contentKeys: SpanContentKey[]): string {
  const labels = contentKeys.map(
    (contentKey) => spanContentAbsenceLabels[contentKey]
  );
  if (labels.length === 1) {
    return `No ${labels[0]}`;
  }
  if (labels.length === 2) {
    return `No ${labels[0]} or ${labels[1]}`;
  }
  return `No ${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function SpanEventCounters({
  exceptionEventCount,
  nonExceptionEventCount,
}: {
  exceptionEventCount: number;
  nonExceptionEventCount: number;
}) {
  return (
    <>
      {nonExceptionEventCount > 0 || exceptionEventCount === 0 ? (
        <Counter>{nonExceptionEventCount}</Counter>
      ) : null}
      {exceptionEventCount > 0 ? (
        <Counter variant="danger">{exceptionEventCount}</Counter>
      ) : null}
    </>
  );
}

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

    &[data-note-composer-open="true"] {
      padding-bottom: var(--global-span-details-section-heading-height);
    }
  }
`;

const spanDetailsBodyCSS = css`
  position: relative;
  isolation: isolate;
`;

const spanDetailsContentAbsenceCSS = css`
  margin: 0;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);

  &[data-bordered="true"] {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const spanDetailsNotesBarCSS = css`
  position: sticky;
  bottom: 0;
  z-index: var(--global-z-index-local-raised);
  flex: none;
  margin-top: auto;
  background: var(--global-background-color-default);

  .span-details-section-heading__heading {
    flex: 1 1 auto;
  }
`;

const spanNoteComposerOverlayCSS = css`
  position: absolute;
  z-index: var(--global-z-index-local-overlay);
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--global-background-color-default);
`;

const notesBarNavigationButtonCSS = css`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--global-dimension-size-100);
  width: 100%;
  color: inherit;
  cursor: pointer;
`;

export function SpanDetails({
  spanNodeId,
  spanPreview,
  initialIsCondensedView = true,
}: {
  spanNodeId: string;
  spanPreview?: SpanDetailsPreview;
  initialIsCondensedView?: boolean;
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
  spanNodeId,
}: {
  isCondensedView: boolean;
  projectId: string;
  selectedSpanAnnotationBar: ReactNode;
  spanNodeId: string;
}) {
  const { span } = useLazyLoadQuery<SpanDetailsHeaderQuery>(
    graphql`
      query SpanDetailsHeaderQuery($id: ID!) {
        span: node(id: $id) {
          __typename
          ... on Span {
            id
            spanId
            trace {
              traceId
            }
            spanKind
            ...SpanHeader_span
          }
        }
      }
    `,
    { id: spanNodeId }
  );

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  return (
    <DetailHeader
      annotationBar={
        <Suspense
          fallback={
            <DetailPanelAnnotationBarSkeleton variant="detail-header" />
          }
        >
          {selectedSpanAnnotationBar}
        </Suspense>
      }
    >
      <div data-span-details-header-id={span.id} data-testid="span-header-row">
        <SpanHeader
          span={span}
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

function SpanDetailsContent({ spanNodeId }: { spanNodeId: string }) {
  const attributesDisclosureProps = useSpanInfoCardProps("attributes");
  const openSpanNoteBar = useOptionalOpenSpanNoteBar();
  const isTakingSpanNotes = usePreferencesContext(
    (state) => state.isTakingSpanNotes
  );
  const isActiveSpanNoteBar = useIsActiveSpanNoteBar(spanNodeId);
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
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
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
      scrollAnimationRef.current?.cancel();
      sectionFeedbackAnimationRef.current?.cancel();
      if (scrollContent) {
        scrollContent.style.transform = "";
      }
      if (sectionFeedbackElementRef.current) {
        sectionFeedbackElementRef.current.style.opacity = "";
      }
    };
  }, []);

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }

  const exceptionEventCount = span.events.filter(
    (event) => event.name === "exception"
  ).length;
  const nonExceptionEventCount = span.events.length - exceptionEventCount;
  const hasEvents = span.events.length > 0;
  const hasNotes = span.spanNotes.length > 0;
  const isNotesPushedBelowViewport =
    spanDetailsSectionsDimensions != null &&
    spanDetailsMainDimensions != null &&
    notesHeadingDimensions != null &&
    spanDetailsMainDimensions.height + notesHeadingDimensions.height >
      spanDetailsSectionsDimensions.height;
  const shouldRenderNotesContent = hasNotes || isNotesPushedBelowViewport;
  const isNoteComposerOpen = isTakingSpanNotes && isActiveSpanNoteBar;
  const spanInfoSectionIds: SpanInfoSectionIds = {
    input: `span-details-${span.spanId}-input`,
    output: `span-details-${span.spanId}-output`,
    toolDefinitions: `span-details-${span.spanId}-tool-definitions`,
    metadata: `span-details-${span.spanId}-metadata`,
  };
  const spanAttributes = parseSpanAttributes(span.attributes).json;
  const spanInfoSectionKeys = getSpanInfoSectionKeys({
    span,
    spanAttributes,
  });
  const missingSpanContentKeys: SpanContentKey[] =
    spanAttributes == null
      ? []
      : [
          ...getExpectedSpanInfoSectionKeys(span.spanKind).filter(
            (sectionKey) => !spanInfoSectionKeys.includes(sectionKey)
          ),
          ...(hasEvents ? [] : (["events"] as const)),
        ];
  const spanContentAbsence =
    missingSpanContentKeys.length > 0
      ? formatSpanContentAbsence(missingSpanContentKeys)
      : null;
  const shouldBorderSpanContentAbsence = spanInfoSectionKeys.length > 0;
  const shouldBorderAttributes =
    spanInfoSectionKeys.length > 0 && spanContentAbsence == null;
  const spanDetailsSectionIds = {
    attributes: `span-details-${span.spanId}-attributes`,
    events: `span-details-${span.spanId}-events`,
    notes: `span-details-${span.spanId}-notes`,
  } as const;

  const jumpToNotes = () => {
    const scrollContainer = spanDetailsSectionsRef.current;
    if (!scrollContainer) {
      return;
    }
    scrollAnimationRef.current?.cancel();
    scrollAnimationRef.current = null;
    const scrollContent = spanDetailsSectionsContentRef.current;
    if (scrollContent) {
      scrollContent.style.transform = "";
    }
    scrollContainer.scrollTop =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
  };

  const showSectionNavigationFeedback = (targetSection: HTMLElement) => {
    const sectionFeedbackElement =
      targetSection.querySelector<HTMLElement>(
        "[data-section-navigation-feedback]"
      ) ??
      (targetSection.id === spanDetailsSectionIds.notes
        ? notesHeadingRef.current?.querySelector<HTMLElement>(
            "[data-section-navigation-feedback]"
          )
        : null);
    if (!sectionFeedbackElement) {
      return;
    }

    sectionFeedbackAnimationRef.current?.cancel();
    if (sectionFeedbackElementRef.current) {
      sectionFeedbackElementRef.current.style.opacity = "";
    }
    sectionFeedbackElementRef.current = sectionFeedbackElement;
    const sectionFeedbackAnimation = animate(
      sectionFeedbackElement,
      { opacity: [0, 1, 1, 0] },
      {
        duration: SECTION_FEEDBACK_ANIMATION_DURATION_SECONDS,
        ease: "easeInOut",
        times: [0, 0.15, 0.55, 1],
        onComplete: () => {
          if (
            sectionFeedbackAnimationRef.current !== sectionFeedbackAnimation
          ) {
            return;
          }
          sectionFeedbackElement.style.opacity = "";
          sectionFeedbackAnimationRef.current = null;
          sectionFeedbackElementRef.current = null;
        },
      }
    );
    sectionFeedbackAnimationRef.current = sectionFeedbackAnimation;
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

    scrollAnimationRef.current?.cancel();
    scrollAnimationRef.current = null;
    scrollContent.style.transform = "";
    sectionFeedbackAnimationRef.current?.cancel();
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
    const scrollAnimation = animate(
      scrollContent,
      { transform: [initialContentTransform, "translateY(0px)"] },
      {
        type: "tween",
        duration: FINAL_SCROLL_ANIMATION_DURATION_SECONDS,
        ease: "easeOut",
        onComplete: () => {
          if (scrollAnimationRef.current !== scrollAnimation) {
            return;
          }
          scrollContent.style.transform = "";
          scrollAnimationRef.current = null;
          showSectionNavigationFeedback(targetSection);
        },
      }
    );
    scrollAnimationRef.current = scrollAnimation;
  };

  return (
    <Flex
      data-span-details-body-id={span.id}
      css={spanDetailsBodyCSS}
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
          {hasEvents ? (
            <SpanDetailSectionLink
              label="Events"
              sectionId={spanDetailsSectionIds.events}
              onClick={handleSectionLinkClick}
            >
              <SpanEventCounters
                exceptionEventCount={exceptionEventCount}
                nonExceptionEventCount={nonExceptionEventCount}
              />
            </SpanDetailSectionLink>
          ) : null}
          <SpanDetailSectionLink
            label="Notes"
            sectionId={spanDetailsSectionIds.notes}
            onClick={handleSectionLinkClick}
          >
            {hasNotes ? <Counter>{span.spanNotes.length}</Counter> : null}
          </SpanDetailSectionLink>
        </ul>
        <SpanInfoCardsToggle />
      </nav>
      <div ref={spanDetailsSectionsRef} css={spanDetailsSectionsCSS}>
        <div
          ref={spanDetailsSectionsContentRef}
          data-span-details-sections-content
          data-note-composer-open={isNoteComposerOpen}
        >
          <div ref={spanDetailsMainRef} data-span-details-main>
            <ErrorBoundary>
              <SpanInfo span={span} sectionIds={spanInfoSectionIds} />
            </ErrorBoundary>
            {spanContentAbsence != null ? (
              <p
                className="span-details__content-absence"
                css={spanDetailsContentAbsenceCSS}
                data-bordered={shouldBorderSpanContentAbsence}
              >
                {spanContentAbsence}
              </p>
            ) : null}
            <section
              id={spanDetailsSectionIds.attributes}
              aria-label="Attributes"
            >
              <DeferredSpanDetailsContent
                fallback={
                  <SpanDetailsSectionHeading bordered={shouldBorderAttributes}>
                    Attributes
                  </SpanDetailsSectionHeading>
                }
                observeAfterFallback
                placeholderHeight={ATTRIBUTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS}
              >
                <SpanAttributesSection
                  attributes={span.attributes}
                  bordered={shouldBorderAttributes}
                  {...attributesDisclosureProps}
                />
              </DeferredSpanDetailsContent>
            </section>
            {hasEvents ? (
              <section id={spanDetailsSectionIds.events} aria-label="Events">
                <SpanDetailsSectionHeading>
                  <Flex
                    elementType="span"
                    direction="row"
                    gap="size-100"
                    alignItems="center"
                  >
                    Events
                    <SpanEventCounters
                      exceptionEventCount={exceptionEventCount}
                      nonExceptionEventCount={nonExceptionEventCount}
                    />
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
            ) : null}
          </div>
          <div data-span-details-notes-bar css={spanDetailsNotesBarCSS}>
            <SpanDetailsSectionHeading
              ref={notesHeadingRef}
              extra={
                openSpanNoteBar && !isNoteComposerOpen ? (
                  <TooltipTrigger>
                    <Button
                      size="S"
                      variant="quiet"
                      aria-label="Take notes"
                      leadingVisual={<Icon svg={<Icons.NotebookPen />} />}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onPress={openSpanNoteBar}
                    />
                    <Tooltip offset={-5}>Take notes</Tooltip>
                  </TooltipTrigger>
                ) : null
              }
            >
              <button
                type="button"
                className="button--reset"
                css={notesBarNavigationButtonCSS}
                aria-label="Notes: jump to notes"
                onClick={jumpToNotes}
              >
                Notes
                <KeyboardToken variant="quiet">
                  {NOTE_HOTKEY.toUpperCase()}
                </KeyboardToken>
                {hasNotes ? <Counter>{span.spanNotes.length}</Counter> : null}
              </button>
            </SpanDetailsSectionHeading>
          </div>
          <section
            id={spanDetailsSectionIds.notes}
            aria-label="Notes"
            data-span-details-notes
          >
            {shouldRenderNotesContent ? (
              <DeferredSpanDetailsContent
                placeholderHeight={NOTES_SECTION_PLACEHOLDER_HEIGHT_PIXELS}
              >
                <Suspense fallback={<Loading />}>
                  <SpanNotesList newNoteId={newNoteId} spanId={span.id} />
                </Suspense>
              </DeferredSpanDetailsContent>
            ) : null}
          </section>
        </div>
      </div>
      {isNoteComposerOpen ? (
        <div data-span-note-composer-overlay css={spanNoteComposerOverlayCSS}>
          <SpanNoteBar onNoteCreated={setNewNoteId} spanNodeId={spanNodeId} />
        </div>
      ) : null}
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
