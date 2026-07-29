import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";

import {
  DetailsPanelContent,
  DetailsPanelNavigationControlsRow,
} from "./DetailsPanel";
import { SessionDetailsHeader } from "./SessionDetailsHeader";
import { SessionDetailsNavigation } from "./SessionDetailsNavigation";
import type { SessionPreview } from "./SessionPaginationContext";
import type { SessionView } from "./SessionViewTabs";
import { SessionViewControl } from "./SessionViewTabs";
import { DetailPanelAnnotationBarSkeleton } from "./TraceDetailsSkeleton";

const navigationSkeletonCSS = css`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  width: 100%;
  margin: 0;
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding-bottom: var(--global-dimension-size-150);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }
`;

const bodySkeletonCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  width: min(100%, 1000px);
  margin: 0 auto;
`;

export function SessionDetailsSkeleton({
  isTreePanelCollapsed,
  isNavigationPointerOpen,
  navigationHeader,
  onNavigationPointerOpenChange,
  onSessionViewChange,
  onTreePanelCollapsedChange,
  preview,
  sessionView,
}: {
  isTreePanelCollapsed: boolean;
  isNavigationPointerOpen: boolean;
  navigationHeader: ReactNode;
  onNavigationPointerOpenChange: (isOpen: boolean) => void;
  onSessionViewChange: (view: SessionView) => void;
  onTreePanelCollapsedChange: (isCollapsed: boolean) => void;
  preview: SessionPreview;
  sessionView: SessionView;
}) {
  return (
    <DetailsPanelContent
      navigation={
        <>
          {navigationHeader}
          <DetailsPanelNavigationControlsRow
            isCollapsed={isTreePanelCollapsed}
            onCollapsedChange={onTreePanelCollapsedChange}
          >
            {sessionView === "traces" ? (
              <Skeleton width={32} height={32} animation="wave" />
            ) : null}
          </DetailsPanelNavigationControlsRow>
          <SessionDetailsNavigation
            control={
              <SessionViewControl
                sessionView={sessionView}
                onSessionViewChange={onSessionViewChange}
                traceCount={preview.traceCount ?? null}
              />
            }
            isCollapsed={isTreePanelCollapsed}
            isPointerOpen={isNavigationPointerOpen}
            onPointerOpenChange={onNavigationPointerOpenChange}
          >
            <ul
              css={navigationSkeletonCSS}
              data-testid="session-navigation-skeleton"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index}>
                  <Skeleton width="45%" height={16} animation="wave" />
                  <Skeleton width="90%" height={14} animation="wave" />
                  <Skeleton width="70%" height={14} animation="wave" />
                </li>
              ))}
            </ul>
          </SessionDetailsNavigation>
        </>
      }
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
        `}
        aria-busy="true"
        data-testid="session-details-skeleton"
      >
        <SessionDetailsHeader
          annotationBar={
            <DetailPanelAnnotationBarSkeleton variant="detail-header" />
          }
          preview={preview}
        />
        <View padding="size-200" overflow="hidden" flex="1 1 auto">
          <div css={bodySkeletonCSS}>
            <Skeleton width="30%" height={16} animation="wave" />
            <Skeleton width="100%" height={112} animation="wave" />
            <Skeleton width="30%" height={16} animation="wave" />
            <Skeleton width="100%" height={140} animation="wave" />
          </div>
        </View>
      </div>
    </DetailsPanelContent>
  );
}
