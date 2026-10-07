import { css, keyframes } from "@emotion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import type { ProjectOnboardingOverlay_project$key } from "./__generated__/ProjectOnboardingOverlay_project.graphql";
import { useRefetchOnStreamAdvance } from "./AnnotationSummary";
import { ProjectOnboarding } from "./ProjectOnboarding";

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
  /* Own stacking context, so z-indexed chart overlays and selection
     indicators inside the tabs cannot paint above the guide. */
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
 * Blocks a project's tab panels with the onboarding guide until the project
 * has traces, then animates away. Renders `children` (the panels) underneath
 * the whole time, so the tables are already mounted and listening to the
 * stream when the first traces land and fill themselves in on the same tick.
 * The tab strip stays outside and usable, and `isEnabled` lets a tab opt out:
 * the Config tab is useful before the first trace, and only the streaming
 * tabs run the poll that would dismiss the guide.
 *
 * Whether to show is decided once, on mount: a project that already has traces
 * never renders the overlay, and one whose traces arrive while it is open exits
 * instead of vanishing. The overlay owns the only query that drives it, a
 * refetch of `hasTraces` on each stream advance, so nothing above it needs to
 * reload or re-key.
 */
export function ProjectOnboardingOverlay({
  project,
  isEnabled,
  children,
}: {
  project: ProjectOnboardingOverlay_project$key;
  /** Whether the active tab shows the guide at all. */
  isEnabled: boolean;
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
  // Traces that arrive while a tab has opted out have no guide to animate, so
  // dismiss at once rather than play the exit on the next tab that shows it.
  // Adjusting state during render is React's pattern for this, see "Storing
  // information from previous renders" in the docs.
  if (isShowing && !isEnabled && data.hasTraces) {
    setIsDismissed(true);
  }
  const isGuideRendered = isShowing && isEnabled;
  const isExiting = isGuideRendered && data.hasTraces;

  useRefetchOnStreamAdvance(() => {
    if (isShowing && !data.hasTraces) {
      refetch({}, { fetchPolicy: "store-and-network" });
    }
  });

  // Take focus so keyboard users land in the guide, not on inert tabs.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isGuideRendered) {
      overlayRef.current?.focus();
    }
  }, [isGuideRendered]);

  return (
    <div css={rootCSS} className="project-onboarding-overlay">
      <div
        css={contentCSS}
        className="project-onboarding-overlay__content"
        inert={isGuideRendered || undefined}
      >
        {children}
      </div>
      {isGuideRendered ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Set up tracing for this project"
          tabIndex={-1}
          data-exiting={isExiting}
          css={overlayCSS}
          className="project-onboarding-overlay__guide"
          onAnimationEnd={(event) => {
            if (isExiting && event.target === event.currentTarget) {
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
