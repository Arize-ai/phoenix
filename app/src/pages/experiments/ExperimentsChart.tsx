import { Suspense } from "react";

import { Loading } from "@phoenix/components";

import { ExperimentsLineChart } from "./ExperimentsLineChart";

export function ExperimentsChart({ datasetId }: { datasetId: string }) {
  return (
    <Suspense fallback={<Loading />}>
      <ExperimentsLineChart datasetId={datasetId} />
    </Suspense>
  );
}
