import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { Suspense, useContext, useEffect, useRef } from "react";
import { TabListStateContext } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
} from "react-resizable-panels";
import { useNavigate } from "react-router";

import {
  Button,
  Counter,
  DialogTrigger,
  ErrorBoundary,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  LinkButton,
  Loading,
  Tab,
  TabList,
  Tabs,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import {
  EDIT_ANNOTATION_HOTKEY,
  NOTE_HOTKEY,
} from "@phoenix/constants/annotationConstants";
import { useNotifySuccess, usePreferencesContext } from "@phoenix/contexts";
import { useDimensions } from "@phoenix/hooks";

import { SpanHeader } from "../SpanHeader";
import type {
  SpanDetailsQuery,
  SpanDetailsQuery$data,
} from "./__generated__/SpanDetailsQuery.graphql";
import { SpanAttributesCard, SpanInfo } from "./span";
import { SpanAside } from "./SpanAside";
import { SpanAsideProvider, useOpenSpanAside } from "./SpanAsideContext";
import { SpanDownloadMenu } from "./SpanDownloadMenu";
import { SpanEventsList } from "./SpanEventsList";
import { SpanInfoCardsToggle } from "./SpanInfoCardsToggle";
import { SpanNoteBar } from "./SpanNoteBar";
import { SpanNoteBarProvider, useOpenSpanNoteBar } from "./SpanNoteBarContext";
import { SpanToDatasetExampleDialog } from "./SpanToDatasetExampleDialog";

type Span = Extract<SpanDetailsQuery$data["span"], { __typename: "Span" }>;

const spanHasException = (span: Span) => {
  return span.events.some((event) => event.name === "exception");
};

// Below this container width the header actions collapse to icon-only buttons.
// The identity row also holds the span kind, name, and status badge, so the
// actions have to give up their labels well before the container gets narrow.
const CONDENSED_VIEW_CONTAINER_WIDTH_THRESHOLD = 1200;
// The side panel sizes in pixels
const ASIDE_PANEL_DEFAULT_SIZE_PIXELS = 400;
const ASIDE_PANEL_MIN_SIZE_PIXELS = 300;
const ASIDE_PANEL_MAX_SIZE_PIXELS = 500;
export function SpanDetails({
  spanNodeId,
}: {
  /**
   * The Global ID of the span
   */
  spanNodeId: string;
}) {
  return (
    <SpanAsideProvider>
      <SpanNoteBarProvider>
        <SpanDetailsContent spanNodeId={spanNodeId} />
      </SpanNoteBarProvider>
    </SpanAsideProvider>
  );
}

function SpanDetailsContent({ spanNodeId }: { spanNodeId: string }) {
  const isAnnotatingSpans = usePreferencesContext(
    (state) => state.isAnnotatingSpans
  );
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const openSpanAside = useOpenSpanAside();
  const openSpanNoteBar = useOpenSpanNoteBar();

  const asidePanelRef = useRef<PanelImperativeHandle>(null);
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
            # sourced from the span rather than the route so span details work
            # when embedded outside a /projects/:projectId route
            project {
              id
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
            ...SpanHeader_span
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

  useHotkeys(EDIT_ANNOTATION_HOTKEY, () => openSpanAside(), {
    preventDefault: true,
  });
  useHotkeys(NOTE_HOTKEY, () => openSpanNoteBar(), {
    preventDefault: true,
  });

  const hasExceptions = spanHasException(span);

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
                    projectId={span.project.id}
                    spanId={span.spanId}
                    traceId={span.trace.traceId}
                    buttonText={isCondensedView ? null : "Download"}
                  />
                </>
              }
            />
          </View>
          <Tabs>
            <TabList extra={<SpanDetailsTabActions />}>
              <Tab id="info">Info</Tab>
              <Tab id="attributes">Attributes</Tab>
              <Tab id="events">
                Events{" "}
                <Counter variant={hasExceptions ? "danger" : "default"}>
                  {span.events.length}
                </Counter>
              </Tab>
            </TabList>
            <LazyTabPanel id="info">
              <Flex direction="row" height="100%">
                <SpanInfoWrap>
                  <ErrorBoundary>
                    <SpanInfo span={span} />
                  </ErrorBoundary>
                </SpanInfoWrap>
              </Flex>
            </LazyTabPanel>
            <LazyTabPanel id="attributes">
              <View
                padding="size-200"
                height="100%"
                maxHeight="100%"
                overflow="auto"
              >
                <SpanAttributesCard attributes={span.attributes} />
              </View>
            </LazyTabPanel>

            <LazyTabPanel id="events">
              <View height="100%" overflow="auto">
                <Suspense fallback={<Loading />}>
                  <SpanEventsList spanId={span.id} />
                </Suspense>
              </View>
            </LazyTabPanel>
          </Tabs>
          <SpanNoteBar spanNodeId={span.id} />
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

/**
 * Controls that sit level with the tabs and act on the selected panel. Only the
 * info tab has any, so the slot is empty on the others rather than offering a
 * control with nothing to act on.
 */
function SpanDetailsTabActions() {
  const selectedTab = useContext(TabListStateContext)?.selectedKey;
  return selectedTab === "info" ? <SpanInfoCardsToggle /> : null;
}

const spanInfoWrapCSS = css`
  flex: 1 1 auto;
  overflow-y: auto;
  // Overflow fails to take into account padding
  & > *:after {
    content: "";
    display: block;
    height: var(--global-dimension-size-400);
  }
`;

/**
 * A wrapper for the span info to style it with the appropriate overflow
 */
function SpanInfoWrap({ children }: PropsWithChildren) {
  return (
    <div css={spanInfoWrapCSS} data-testid="span-info-wrap">
      {children}
    </div>
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
      <ViewportModalOverlay>
        <ViewportModal size="L">
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
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
