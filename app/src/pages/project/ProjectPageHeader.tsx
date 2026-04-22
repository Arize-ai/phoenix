import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Flex, Loading, View } from "@phoenix/components";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import type { ProjectStats_project$key } from "./__generated__/ProjectStats_project.graphql";
import { ProjectStats } from "./ProjectStats";
import { ProjectTraceCountSparkline } from "./ProjectTraceCountSparkline";

export function ProjectPageHeader(props: {
  project: ProjectStats_project$key;
  /**
   * the extra component displayed on the right side of the header
   */
  extra: ReactNode;
}) {
  const { extra } = props;
  const isTracingUxEnabled = useFeatureFlag("tracing_ux");
  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-200"
      paddingBottom="size-50"
      flex="none"
      overflow="visible"
    >
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        {isTracingUxEnabled ? (
          <Suspense fallback={<Loading size="S" />}>
            <ProjectTraceCountSparkline />
          </Suspense>
        ) : (
          <div css={statsScrollCSS}>
            <ProjectStats project={props.project} />
          </div>
        )}
        <View flex="none" paddingStart="size-100">
          {extra}
        </View>
      </Flex>
    </View>
  );
}

const statsScrollCSS = css`
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1 1 auto;
  background-image:
    linear-gradient(
      to right,
      var(--global-color-gray-75),
      var(--global-color-gray-75)
    ),
    linear-gradient(
      to right,
      var(--global-color-gray-75),
      var(--global-color-gray-75)
    ),
    linear-gradient(
      to right,
      rgba(var(--global-color-gray-300-rgb), 0.9),
      rgba(var(--global-color-gray-300-rgb), 0)
    ),
    linear-gradient(
      to left,
      rgba(var(--global-color-gray-300-rgb), 0.9),
      rgba(var(--global-color-gray-300-rgb), 0)
    );
  background-repeat: no-repeat;
  background-size:
    32px 100%,
    32px 100%,
    32px 100%,
    32px 100%;
  background-position:
    left center,
    right center,
    left center,
    right center;
  background-attachment: local, local, scroll, scroll;
`;
