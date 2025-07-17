import { Suspense } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Heading, View } from "@phoenix/components";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { ExperimentsChart } from "@phoenix/pages/experiments/ExperimentsChart";
import { experimentsLoader } from "@phoenix/pages/experiments/experimentsLoader";

import { ExperimentsEmpty } from "./ExperimentsEmpty";
import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const loaderData = useLoaderData<typeof experimentsLoader>();
  invariant(loaderData, "loaderData is required");
  if (!loaderData.dataset.firstExperiment?.edges.length) {
    return <ExperimentsEmpty />;
  }
  return (
    <>
      <PanelGroup direction="vertical" autoSaveId="experiments-layout">
        <Panel order={0} minSize={20} maxSize={30} defaultSize={20} collapsible>
          <View paddingX="size-200" paddingY="size-100">
            <Heading level={2}>Experiments Analysis</Heading>
          </View>
          <ExperimentsChart datasetId={loaderData.dataset.id} />
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel order={1}>
          <View height="100%" overflow="hidden" flex="1 1 auto">
            <ExperimentsTable dataset={loaderData.dataset} />
          </View>
        </Panel>
      </PanelGroup>
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
