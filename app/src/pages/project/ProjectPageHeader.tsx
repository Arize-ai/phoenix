import { Suspense } from "react";

import { Loading, View } from "@phoenix/components";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { ProjectTraceCountSparkline } from "./ProjectTraceCountSparkline";

export function ProjectPageHeader() {
  const isTracingUxEnabled = useFeatureFlag("tracing_ux");
  if (!isTracingUxEnabled) {
    return null;
  }
  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-200"
      paddingBottom="size-50"
      flex="none"
      overflow="visible"
    >
      <Suspense fallback={<Loading size="S" />}>
        <ProjectTraceCountSparkline />
      </Suspense>
    </View>
  );
}
