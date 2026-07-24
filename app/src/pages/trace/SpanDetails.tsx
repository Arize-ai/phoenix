import { css } from "@emotion/react";
import { animate, useReducedMotion } from "motion/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Suspense, useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
} from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";

import {
  Button,
  Counter,
  DialogTrigger,
  ErrorBoundary,
  Flex,
  Icon,
  Icons,
  Keyboard,
  LinkButton,
  Loading,
  Modal,
  ModalOverlay,
  SectionHeading,
  ToggleButton,
  View,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";
import { useNotifySuccess, usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";

import { SpanHeader } from "../SpanHeader";
import type {
  SpanDetailsQuery,
  SpanDetailsQuery$data,
} from "./__generated__/SpanDetailsQuery.graphql";
import { SpanAttributesCard, SpanInfo } from "./span";
import { SpanAside } from "./SpanAside";
import { SpanDownloadMenu } from "./SpanDownloadMenu";
import { SpanEventsList } from "./SpanEventsList";
import { SpanFeedback } from "./SpanFeedback";
import { SpanToDatasetExampleDialog } from "./SpanToDatasetExampleDialog";

type Span = Extract<SpanDetailsQuery$data["span"], { __typename: "Span" }>;

const spanHasException = (span: Span) => {
  return span.events.some((event) => event.name === "exception");
};

const CONDENSED_VIEW_CONTAINER_WIDTH_THRESHOLD = 950;
// The side panel sizes in pixels
const ASIDE_PANEL_DEFAULT_SIZE_PIXELS = 400;
const ASIDE_PANEL_MIN_SIZE_PIXELS = 300;
const ASIDE_PANEL_MAX_SIZE_PIXELS = 500;
const FINAL_SCROLL_ANIMATION_DISTANCE_PIXELS = 80;
const FINAL_SCROLL_ANIMATION_DURATION_SECONDS = 0.18;
const SECTION_FEEDBACK_ANIMATION_DURATION_SECONDS = 0.5;

const spanDetailsAnchorNavCSS = css`
  flex: none;
  border-bottom: 1px solid var(--global-border-color-default);

  ul {
    display: flex;
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
`;

const spanDetailsSectionsCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;

  section:last-of-type:after {
    content: "";
    display: block;
    height: var(--global-dimension-size-400);
  }
`;

const spanDetailsSectionHeadingCSS = css`
  position: relative;
  isolation: isolate;

  & > :first-child {
    position: relative;
    z-index: 1;
  }

  [data-section-navigation-feedback] {
    position: absolute;
    inset: 1px 0;
    z-index: 0;
    background-color: var(--highlight-background);
    opacity: 0;
    pointer-events: none;
  }
`;

function SpanDetailsSectionHeading({
  children,
  bordered,
}: PropsWithChildren & { bordered?: boolean }) {
  return (
    <div css={spanDetailsSectionHeadingCSS}>
      <SectionHeading bordered={bordered}>{children}</SectionHeading>
      <span aria-hidden="true" data-section-navigation-feedback />
    </div>
  );
}

export function SpanDetails({
  spanNodeId,
}: {
  /**
   * The Global ID of the span
   */
  spanNodeId: string;
}) {
  const { projectId } = useParams();
  const isAnnotatingSpans = usePreferencesContext(
    (state) => state.isAnnotatingSpans
  );
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const shouldReduceMotion = useReducedMotion();

  const asidePanelRef = useRef<PanelImperativeHandle>(null);
  const spanDetailsSectionsRef = useRef<HTMLDivElement>(null);
  const spanDetailsSectionsContentRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const sectionFeedbackAnimationRef = useRef<ReturnType<typeof animate> | null>(
    null
  );
  const sectionFeedbackElementRef = useRef<HTMLElement | null>(null);
  // Sync the aside panel collapsed state with the isAnnotatingSpans preference.
  // This handles initial mount (panel starts expanded by default, collapse if not annotating)
  // and external changes to isAnnotatingSpans (e.g. from the hotkey).
  useEffect(() => {
    const panel = asidePanelRef.current;
    if (!panel) return;
    if (isAnnotatingSpans && panel.isCollapsed()) {
      panel.expand();
    } else if (!isAnnotatingSpans && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, [isAnnotatingSpans]);
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
  const spanDetailsContainerRef = useRef<HTMLDivElement>(null);
  const spanDetailsContainerDimensions = useDimensions(spanDetailsContainerRef);
  const isCondensedView = spanDetailsContainerDimensions?.width
    ? spanDetailsContainerDimensions.width <
      CONDENSED_VIEW_CONTAINER_WIDTH_THRESHOLD
    : true;
  const { span } = useLazyLoadQuery<SpanDetailsQuery>(
    graphql`
      query SpanDetailsQuery($id: ID!) {
        span: node(id: $id) {
          __typename
          ... on Span {
            id
            spanId
            trace {
              id
              traceId
            }
            name
            spanKind
            statusCode: propagatedStatusCode
            statusMessage
            startTime
            parentId
            latencyMs
            tokenCountTotal
            startTime
            endTime
            id
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
              message
              timestamp
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
            spanAnnotations {
              id
              name
            }
            ...SpanHeader_span
            ...SpanFeedback_annotations
            ...SpanAside_span
          }
        }
      }
    `,
    {
      id: spanNodeId,
    }
  );

  if (span.__typename !== "Span") {
    throw new Error(
      "Expected a span, but got a different type" + span.__typename
    );
  }
  if (projectId == null) {
    throw new Error("Project ID is required to download a span");
  }

  useHotkeys(
    EDIT_ANNOTATION_HOTKEY,
    () => {
      if (!isAnnotatingSpans) {
        setIsAnnotatingSpans(true);
        asidePanelRef.current?.expand();
      }
    },
    { preventDefault: true }
  );

  const hasExceptions = spanHasException(span);
  const spanDetailsSectionIds = {
    info: `span-details-${span.spanId}-info`,
    annotations: `span-details-${span.spanId}-annotations`,
    attributes: `span-details-${span.spanId}-attributes`,
    events: `span-details-${span.spanId}-events`,
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
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
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

    if (!hasFullAnimationDistance) {
      showSectionNavigationFeedback(targetSection);
      return;
    }

    if (shouldReduceMotion) {
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
    <Group orientation="horizontal" id="span-details-layout">
      <Panel>
        <Flex
          direction="column"
          flex="1 1 auto"
          height="100%"
          ref={spanDetailsContainerRef}
        >
          <View
            paddingTop="size-100"
            paddingBottom="size-100"
            paddingStart="size-150"
            paddingEnd="size-200"
            flex="none"
            data-testid="span-header-row"
          >
            <SpanHeader
              span={span}
              actions={
                <>
                  <LinkButton
                    variant={span.spanKind !== "llm" ? "default" : "primary"}
                    leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
                    isDisabled={span.spanKind !== "llm"}
                    to={`/playground/spans/${span.id}`}
                    size="S"
                    aria-label="Prompt Playground"
                  >
                    {isCondensedView ? null : "Playground"}
                  </LinkButton>
                  <AddSpanToDatasetButton
                    span={span}
                    buttonText={isCondensedView ? null : "Add to Dataset"}
                  />
                  <SpanDownloadMenu
                    projectId={projectId}
                    spanId={span.spanId}
                    traceId={span.trace.traceId}
                    buttonText={isCondensedView ? null : "Download"}
                  />
                  <ToggleButton
                    size="S"
                    isSelected={isAnnotatingSpans}
                    onPress={() => {
                      const next = !isAnnotatingSpans;
                      setIsAnnotatingSpans(next);
                      const asidePanel = asidePanelRef.current;
                      if (asidePanel) {
                        if (next) {
                          asidePanel.expand();
                        } else {
                          asidePanel.collapse();
                        }
                      }
                    }}
                    leadingVisual={<Icon svg={<Icons.Edit2 />} />}
                    trailingVisual={
                      !isCondensedView &&
                      !isAnnotatingSpans && (
                        <Keyboard>{EDIT_ANNOTATION_HOTKEY}</Keyboard>
                      )
                    }
                  >
                    {isCondensedView ? null : "Annotate"}
                  </ToggleButton>
                </>
              }
            />
          </View>
          <nav css={spanDetailsAnchorNavCSS} aria-label="Span detail sections">
            <ul>
              <li>
                <a
                  href={`#${spanDetailsSectionIds.info}`}
                  onClick={(event) =>
                    handleSectionLinkClick({
                      event,
                      sectionId: spanDetailsSectionIds.info,
                    })
                  }
                >
                  Info
                </a>
              </li>
              <li>
                <a
                  href={`#${spanDetailsSectionIds.annotations}`}
                  onClick={(event) =>
                    handleSectionLinkClick({
                      event,
                      sectionId: spanDetailsSectionIds.annotations,
                    })
                  }
                >
                  Annotations <Counter>{span.spanAnnotations.length}</Counter>
                </a>
              </li>
              <li>
                <a
                  href={`#${spanDetailsSectionIds.attributes}`}
                  onClick={(event) =>
                    handleSectionLinkClick({
                      event,
                      sectionId: spanDetailsSectionIds.attributes,
                    })
                  }
                >
                  Attributes
                </a>
              </li>
              <li>
                <a
                  href={`#${spanDetailsSectionIds.events}`}
                  onClick={(event) =>
                    handleSectionLinkClick({
                      event,
                      sectionId: spanDetailsSectionIds.events,
                    })
                  }
                >
                  Events
                  <Counter variant={hasExceptions ? "danger" : "default"}>
                    {span.events.length}
                  </Counter>
                </a>
              </li>
            </ul>
          </nav>
          <div ref={spanDetailsSectionsRef} css={spanDetailsSectionsCSS}>
            <div ref={spanDetailsSectionsContentRef}>
              <section id={spanDetailsSectionIds.info} aria-label="Info">
                <SpanDetailsSectionHeading bordered={false}>
                  Info
                </SpanDetailsSectionHeading>
                <ErrorBoundary>
                  <SpanInfo span={span} />
                </ErrorBoundary>
              </section>
              <section
                id={spanDetailsSectionIds.annotations}
                aria-label="Annotations"
              >
                <SpanDetailsSectionHeading>
                  <Flex
                    elementType="span"
                    direction="row"
                    gap="size-100"
                    alignItems="center"
                  >
                    Annotations <Counter>{span.spanAnnotations.length}</Counter>
                  </Flex>
                </SpanDetailsSectionHeading>
                <SpanFeedback span={span} />
              </section>
              <section
                id={spanDetailsSectionIds.attributes}
                aria-label="Attributes"
              >
                <SpanDetailsSectionHeading>
                  Attributes
                </SpanDetailsSectionHeading>
                <View padding="size-200">
                  <SpanAttributesCard attributes={span.attributes} />
                </View>
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
                <View>
                  <Suspense fallback={<Loading />}>
                    <SpanEventsList spanId={span.id} />
                  </Suspense>
                </View>
              </section>
            </div>
          </div>
        </Flex>
      </Panel>
      <Separator
        css={compactResizeHandleCSS}
        disabled={!isAnnotatingSpans}
        style={isAnnotatingSpans ? undefined : { display: "none" }}
      />
      <Panel
        panelRef={asidePanelRef}
        defaultSize={ASIDE_PANEL_DEFAULT_SIZE_PIXELS}
        collapsedSize={0}
        minSize={ASIDE_PANEL_MIN_SIZE_PIXELS}
        maxSize={ASIDE_PANEL_MAX_SIZE_PIXELS}
        collapsible
        onResize={(panelSize) => {
          if (panelSize.asPercentage === 0) {
            setIsAnnotatingSpans(false);
          }
        }}
      >
        <SpanAside span={span} />
      </Panel>
    </Group>
  );
}

function AddSpanToDatasetButton({
  span,
  buttonText,
}: {
  span: Span;
  buttonText: string | null;
}) {
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="S"
        leadingVisual={<Icon svg={<Icons.Database />} />}
      >
        {buttonText}
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <Suspense fallback={<Loading />}>
            <SpanToDatasetExampleDialog
              spanId={span.id}
              onCompleted={(datasetId) => {
                notifySuccess({
                  title: "Span Added to Dataset",
                  message: "Successfully added span to dataset",
                  action: {
                    text: "View Dataset",
                    onClick: () => {
                      navigate(`/datasets/${datasetId}/examples`);
                    },
                  },
                });
              }}
            />
          </Suspense>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
