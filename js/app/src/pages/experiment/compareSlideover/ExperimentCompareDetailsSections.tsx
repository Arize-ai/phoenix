import { css } from "@emotion/react";
import { Suspense, useRef, useState } from "react";

import { Skeleton } from "@phoenix/components";
import {
  SectionNav,
  SectionNavSection,
} from "@phoenix/components/core/sectionnav";
import type { SelectedTraceDetails } from "@phoenix/pages/experiment/TraceDetailsDrawer";

import { ExperimentCompareExampleRevisionCard } from "./ExperimentCompareExampleRevisionCard";
import { ExperimentCompareLaneAnnotations } from "./ExperimentCompareLaneAnnotations";
import { ExperimentCompareLaneMetadata } from "./ExperimentCompareLaneMetadata";
import { ExperimentCompareLaneOutput } from "./ExperimentCompareLaneOutput";
import { ExperimentCompareLaneRow } from "./ExperimentCompareLaneRow";
import type {
  AnnotationConfigsByName,
  CompareLane,
} from "./experimentCompareLaneTypes";

const SECTIONS = [
  { id: "experiment-compare-annotations", label: "Annotations" },
  { id: "experiment-compare-output", label: "Output" },
  { id: "experiment-compare-reference-output", label: "Reference Output" },
  { id: "experiment-compare-input", label: "Input" },
  { id: "experiment-compare-metadata", label: "Metadata" },
] as const;

const [
  ANNOTATIONS_SECTION,
  OUTPUT_SECTION,
  REFERENCE_OUTPUT_SECTION,
  INPUT_SECTION,
  METADATA_SECTION,
] = SECTIONS;

const detailsSectionsCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;

  .experiment-compare-details__nav {
    flex: none;
    padding: 0 var(--global-dimension-size-100);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .experiment-compare-details__scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    --section-nav-scroll-inset: 0px;
  }

  .experiment-compare-details__section {
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    &:focus-visible {
      outline-offset: calc(-1 * var(--focus-ring-thickness));
      border-radius: 0;
    }
  }

  .experiment-compare-details__section .experiment-compare-lane-row__cell,
  .experiment-compare-details__shared {
    padding: var(--global-dimension-size-100);
  }
`;

const laneSkeletonCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

function LaneCellSkeleton({ height }: { height: number }) {
  return (
    <div css={laneSkeletonCSS} aria-busy="true">
      <Skeleton height={height} />
    </div>
  );
}

/**
 * Details mode: the scrollspy bar over one section per kind of content. Lane
 * sections split into one cell per lane, so a row lines up across the
 * experiments; the example's input and reference output span the full width.
 */
export function ExperimentCompareDetailsSections({
  exampleId,
  datasetVersionId,
  lanes,
  annotationNames,
  annotationConfigsByName,
  onOpenTrace,
}: {
  exampleId: string;
  datasetVersionId: string;
  /** The base lane, then the compare lane when there is one */
  lanes: readonly CompareLane[];
  annotationNames: readonly string[];
  annotationConfigsByName: AnnotationConfigsByName;
  onOpenTrace: (details: SelectedTraceDetails) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const baseLane = lanes[0];
  const getLaneKey = (lane: CompareLane) =>
    `${exampleId}:${lane.experiment.id}`;
  return (
    <div className="experiment-compare-details" css={detailsSectionsCSS}>
      <SectionNav
        aria-label="Run details"
        className="experiment-compare-details__nav"
        sections={SECTIONS}
        scrollContainerRef={scrollContainerRef}
      />
      <div
        ref={scrollContainerRef}
        className="experiment-compare-details__scroll"
      >
        <SectionNavSection
          id={ANNOTATIONS_SECTION.id}
          heading={ANNOTATIONS_SECTION.label}
          isHeadingHidden
          className="experiment-compare-details__section"
        >
          <ExperimentCompareLaneRow lanes={lanes}>
            {(lane) => (
              <Suspense
                key={getLaneKey(lane)}
                fallback={<LaneCellSkeleton height={160} />}
              >
                <ExperimentCompareLaneAnnotations
                  exampleId={exampleId}
                  lane={lane}
                  baseLane={lane.side === "compare" ? baseLane : null}
                  annotationNames={annotationNames}
                  annotationConfigsByName={annotationConfigsByName}
                  onOpenTrace={onOpenTrace}
                />
              </Suspense>
            )}
          </ExperimentCompareLaneRow>
        </SectionNavSection>
        <SectionNavSection
          id={OUTPUT_SECTION.id}
          heading={OUTPUT_SECTION.label}
          isHeadingHidden
          className="experiment-compare-details__section"
        >
          <ExperimentCompareLaneRow lanes={lanes}>
            {(lane) => (
              <Suspense
                key={getLaneKey(lane)}
                fallback={<LaneCellSkeleton height={200} />}
              >
                <ExperimentCompareLaneOutput
                  exampleId={exampleId}
                  lane={lane}
                  isExpanded={isOutputExpanded}
                  onExpandedChange={setIsOutputExpanded}
                />
              </Suspense>
            )}
          </ExperimentCompareLaneRow>
        </SectionNavSection>
        <SectionNavSection
          id={REFERENCE_OUTPUT_SECTION.id}
          heading={REFERENCE_OUTPUT_SECTION.label}
          isHeadingHidden
          className="experiment-compare-details__section"
        >
          <div className="experiment-compare-details__shared">
            <Suspense
              key={exampleId}
              fallback={<LaneCellSkeleton height={120} />}
            >
              <ExperimentCompareExampleRevisionCard
                exampleId={exampleId}
                datasetVersionId={datasetVersionId}
                field="referenceOutput"
              />
            </Suspense>
          </div>
        </SectionNavSection>
        <SectionNavSection
          id={INPUT_SECTION.id}
          heading={INPUT_SECTION.label}
          isHeadingHidden
          className="experiment-compare-details__section"
        >
          <div className="experiment-compare-details__shared">
            <Suspense
              key={exampleId}
              fallback={<LaneCellSkeleton height={120} />}
            >
              <ExperimentCompareExampleRevisionCard
                exampleId={exampleId}
                datasetVersionId={datasetVersionId}
                field="input"
              />
            </Suspense>
          </div>
        </SectionNavSection>
        <SectionNavSection
          id={METADATA_SECTION.id}
          heading={METADATA_SECTION.label}
          isHeadingHidden
          className="experiment-compare-details__section"
        >
          <ExperimentCompareLaneRow lanes={lanes}>
            {(lane) => (
              <Suspense
                key={getLaneKey(lane)}
                fallback={<LaneCellSkeleton height={120} />}
              >
                <ExperimentCompareLaneMetadata
                  exampleId={exampleId}
                  lane={lane}
                />
              </Suspense>
            )}
          </ExperimentCompareLaneRow>
        </SectionNavSection>
      </div>
    </div>
  );
}
