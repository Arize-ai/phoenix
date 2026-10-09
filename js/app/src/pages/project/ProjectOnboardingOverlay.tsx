import { css, keyframes } from "@emotion/react";
import {
  type ReactNode,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import type { ProjectOnboardingOverlay_project$key } from "./__generated__/ProjectOnboardingOverlay_project.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";

/**
 * How often the guide asks whether the project has traces yet. Independent of
 * live streaming: a user who paused streaming still needs the guide to leave.
 */
const POLL_INTERVAL_MS = 2000;

/** Matches the exit keyframes below so the overlay unmounts as they finish. */
const EXIT_ANIMATION_DURATION_MS = 400;

const exitAnimation = keyframes`
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-16px);
  }
`;

const rootCSS = css`
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const contentCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  outline: none;
  /* Own stacking context, so z-indexed chart overlays and selection
     indicators inside the panel cannot paint above the guide. */
  isolation: isolate;
`;

const overlayCSS = css`
  position: absolute;
  inset: 0;
  z-index: 1;
  background-color: var(--global-color-gray-75);
  outline: none;

  &[data-exiting="true"] {
    animation: ${exitAnimation} ${EXIT_ANIMATION_DURATION_MS}ms ease-in forwards;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-exiting="true"] {
      animation-duration: 1ms;
    }
  }
`;

/**
 * Blocks a tab panel with the onboarding guide until the project has traces,
 * then animates away. Renders `children` (the panel content) underneath the
 * whole time, so the table is already mounted when the first traces land.
 *
 * Mounted inside a tab panel rather than around the tabs: React Aria builds
 * the tab collection from everything under `Tabs` except panel content, so
 * the guide's own language tabs would otherwise join the project tab strip.
 * The strip stays usable, and tabs that do not wrap their panel (Config,
 * Metrics) show their content, since Config is useful before the first trace.
 *
 * Whether to show is decided once, on mount, from `hasTraces` in the store.
 * The project route loader fetches that field on every visit, so the store is
 * fresh here and a project that already has traces never renders the guide.
 * While shown, the guide polls `hasTraces` itself, so it leaves even when live
 * streaming is paused, and it advances the stream fetch key as it goes so the
 * tables underneath refetch on the same beat.
 */
export function ProjectOnboardingOverlay({
  project,
  children,
}: {
  project: ProjectOnboardingOverlay_project$key;
  children: ReactNode;
}) {
  const [data, refetch] = useRefetchableFragment(
    graphql`
      fragment ProjectOnboardingOverlay_project on Project
      @refetchable(queryName: "ProjectOnboardingOverlayRefetchQuery") {
        name
        hasTraces
      }
    `,
    project
  );
  const [wasEmptyOnMount] = useState(() => !data.hasTraces);
  const [isDismissed, setIsDismissed] = useState(false);
  const isShowing = wasEmptyOnMount && !isDismissed;
  const isExiting = isShowing && data.hasTraces;

  useInterval(
    () => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "network-only" });
      });
    },
    isShowing && !data.hasTraces ? POLL_INTERVAL_MS : null
  );

  // The tables refetch when the stream fetch key changes. Streaming advances it
  // on its own when it is on; when it is paused, the guide's own poll is the
  // only thing that knows the first traces have landed.
  const { isStreaming, setFetchKey } = useStreamState();
  useEffect(() => {
    if (isExiting && !isStreaming) {
      setFetchKey(`onboarding-traces-${Date.now()}`);
    }
  }, [isExiting, isStreaming, setFetchKey]);

  // Take focus only when nothing has it. The overlay remounts on every tab
  // switch of an empty project, and stealing focus from the tab strip would
  // break arrow-key navigation between tabs.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      isShowing &&
      (document.activeElement === null ||
        document.activeElement === document.body)
    ) {
      overlayRef.current?.focus();
    }
  }, [isShowing]);

  // When the guide unmounts with focus inside it, hand focus to the panel it
  // was covering rather than letting it fall to the document body.
  const contentRef = useRef<HTMLDivElement>(null);
  const focusContentOnDismissRef = useRef(false);
  useEffect(() => {
    if (isDismissed && focusContentOnDismissRef.current) {
      focusContentOnDismissRef.current = false;
      contentRef.current?.focus();
    }
  }, [isDismissed]);

  return (
    <div css={rootCSS} className="project-onboarding-overlay">
      <div
        ref={contentRef}
        css={contentCSS}
        className="project-onboarding-overlay__content"
        inert={isShowing || undefined}
        tabIndex={-1}
      >
        {children}
      </div>
      {isShowing ? (
        <div
          ref={overlayRef}
          // A region, not a modal dialog: the tab strip beside it stays usable,
          // and `aria-modal` would tell assistive technology otherwise.
          role="region"
          aria-label="Set up tracing for this project"
          tabIndex={-1}
          data-exiting={isExiting}
          css={overlayCSS}
          className="project-onboarding-overlay__guide"
          onAnimationEnd={(event) => {
            if (isExiting && event.target === event.currentTarget) {
              focusContentOnDismissRef.current = event.currentTarget.contains(
                document.activeElement
              );
              setIsDismissed(true);
            }
          }}
        >
          <ProjectOnboarding projectName={data.name ?? "my-project"} />
        </div>
      ) : null}
    </div>
  );
}
