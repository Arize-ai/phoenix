import { useEffect, useRef } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { useNotifySuccess } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { ProjectOnboardingGateQuery } from "./__generated__/ProjectOnboardingGateQuery.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";

/**
 * Keeps the onboarding "waiting for traces" screen live and swaps in the
 * table when the project's first trace arrives. The page-level queries are
 * preloaded once and never refetched, so on their own the onboarding screen
 * would sit on "Waiting for traces to arrive..." forever, even after the
 * first trace landed (a reload was required to see it).
 *
 * While `hasTraces` is false, renders the onboarding screen alongside a
 * poller that re-reads the project's `hasTraces` keyed on the stream
 * `fetchKey` -- bumped by `ProjectTimeRangeControls` when its poll of
 * `streamingLastUpdatedAt` sees new data. The poller's response updates the
 * Relay store record the parent's preloaded query is subscribed to, which is
 * what flips the `hasTraces` prop here.
 *
 * The gate itself stays mounted across the flip -- the effect that
 * celebrates the first trace cannot live on the onboarding side, because
 * that subtree unmounts in the same commit that flips the flag. On the flip
 * it bumps the stream fetchKey once more: the children mount on the
 * preload's stale, empty rows and skip their mount refetch on the assumption
 * that the preload is fresh, and the bump is the tables' documented refetch
 * trigger. It is what puts the first trace on screen.
 */
export function ProjectOnboardingGate({
  hasTraces,
  projectName,
  children,
}: {
  hasTraces: boolean;
  projectName: string;
  children: React.ReactNode;
}) {
  const { setFetchKey } = useStreamState();
  const notifySuccess = useNotifySuccess();
  // Only a project that was empty when this mounted has a "first trace"
  // moment; switching onto a populated tab must stay quiet.
  const wasEmptyOnMountRef = useRef(!hasTraces);
  const hasCelebratedRef = useRef(false);
  useEffect(() => {
    if (wasEmptyOnMountRef.current && hasTraces && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      notifySuccess({
        title: "First trace received 🎉",
        message:
          "Your instrumentation is working. New traces will appear as they arrive.",
      });
      setFetchKey(`first-trace-${Date.now()}`);
    }
  }, [hasTraces, notifySuccess, setFetchKey]);

  if (!hasTraces) {
    return <OnboardingWithHasTracesPoller projectName={projectName} />;
  }
  return <>{children}</>;
}

/**
 * The onboarding screen plus the query that lets it end. Kept separate from
 * the gate so populated projects never run the polling query.
 */
function OnboardingWithHasTracesPoller({
  projectName,
}: {
  projectName: string;
}) {
  const { projectId } = useParams();
  invariant(projectId, "Project ID is required");
  const { fetchKey } = useStreamState();
  // The result is intentionally unused: the query's job is to write the
  // project's current `hasTraces` into the Relay store, where the parent
  // page's subscription picks it up. The preloaded page query has already
  // put `hasTraces: false` in the store, so the first render is a store
  // hit; each fetchKey bump re-confirms against the network.
  useLazyLoadQuery<ProjectOnboardingGateQuery>(
    graphql`
      query ProjectOnboardingGateQuery($id: ID!) {
        project: node(id: $id) {
          ... on Project {
            hasTraces
          }
        }
      }
    `,
    { id: projectId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return <ProjectOnboarding projectName={projectName} />;
}
