import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Flex, Loading, View } from "@phoenix/components";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import type { ProjectStats_project$key } from "./__generated__/ProjectStats_project.graphql";
import { ProjectSpanCountSparkline } from "./ProjectSpanCountSparkline";
import { ProjectStats } from "./ProjectStats";

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
    <div css={headerCSS}>
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        {isTracingUxEnabled ? (
          <div css={sparklineContainerCSS}>
            <Suspense fallback={<Loading size="S" />}>
              <ProjectSpanCountSparkline />
            </Suspense>
          </div>
        ) : (
          <div css={statsScrollCSS}>
            <ProjectStats project={props.project} direction="row" />
          </div>
        )}
        <View flex="none" paddingStart="size-100">
          {extra}
        </View>
      </Flex>
    </div>
  );
}

const headerCSS = css`
  flex: none;
  box-sizing: border-box;
  padding: var(--global-dimension-static-size-200)
    var(--global-dimension-static-size-200)
    var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-200);
  overflow: visible;
`;

const sparklineContainerCSS = css`
  flex: 1 1 auto;
  height: 72px;
  min-width: 0;
  overflow: visible;
  .recharts-responsive-container,
  .recharts-wrapper {
    overflow: visible !important;
  }
`;

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
