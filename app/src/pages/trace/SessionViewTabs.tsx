import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Button,
  Counter,
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
} from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";

export type SessionView = "turns" | "traces";

export function isSessionView(value: unknown): value is SessionView {
  return value === "turns" || value === "traces";
}

const sessionViewControlCSS = css`
  box-sizing: border-box;
  padding: var(--global-dimension-size-100);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  .segmented-control {
    width: 100%;
  }

  /* The compact button and expanded segmented control are both size S. Keep
   * their wrappers on that same 30px height contract so switching modes does
   * not move the navigation body by the 2px spacing-token difference. */
  .session-view-control__expanded,
  .session-view-control__compact {
    height: var(--global-button-height-s);
  }

  .session-view-control__compact {
    display: none;
    align-items: center;
    justify-content: flex-start;
  }
`;

const sessionViewControlItemCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

export function SessionViewControl({
  sessionView,
  onSessionViewChange,
  traceCount,
}: {
  sessionView: SessionView;
  onSessionViewChange: (view: SessionView) => void;
  traceCount: number | null;
}) {
  const nextSessionView: SessionView =
    sessionView === "turns" ? "traces" : "turns";
  return (
    <div className="session-view-control" css={sessionViewControlCSS}>
      <div className="session-view-control__expanded">
        <SegmentedControl
          aria-label="Session view"
          size="S"
          isJustified
          selectedKey={sessionView}
          onSelectionChange={(key) => {
            if (isSessionView(key)) {
              onSessionViewChange(key);
            }
          }}
        >
          <SegmentedControlItem id="turns">
            <span css={sessionViewControlItemCSS}>
              <Icon svg={<Icons.MessagesSquare />} />
              <span className="session-view-control__label">Turns</span>
              <Counter variant="quiet">
                {traceCount == null ? (
                  <Skeleton width={16} height={12} animation="wave" />
                ) : (
                  traceCount
                )}
              </Counter>
            </span>
          </SegmentedControlItem>
          <SegmentedControlItem id="traces">
            <span css={sessionViewControlItemCSS}>
              <Icon svg={<Icons.Trace />} />
              <span className="session-view-control__label">Traces</span>
              <Counter variant="quiet">
                {traceCount == null ? (
                  <Skeleton width={16} height={12} animation="wave" />
                ) : (
                  traceCount
                )}
              </Counter>
            </span>
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="session-view-control__compact">
        <Button
          size="S"
          variant="quiet"
          aria-label={`Switch to ${nextSessionView} view`}
          leadingVisual={
            <Icon
              svg={
                nextSessionView === "turns" ? (
                  <Icons.MessagesSquare />
                ) : (
                  <Icons.Trace />
                )
              }
            />
          }
          onPress={() => onSessionViewChange(nextSessionView)}
        />
      </div>
    </div>
  );
}

/** Session view switcher with content below it. */
export function SessionViewTabs({
  sessionView,
  onSessionViewChange,
  traceCount,
  children,
}: {
  sessionView: SessionView;
  onSessionViewChange: (view: SessionView) => void;
  traceCount: number | null;
  children: ReactNode;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      `}
    >
      <SessionViewControl
        sessionView={sessionView}
        onSessionViewChange={onSessionViewChange}
        traceCount={traceCount}
      />
      {children}
    </div>
  );
}
