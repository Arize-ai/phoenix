import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert, Card, View } from "@arizeai/components";

import { TracePageQuery } from "./__generated__/TracePageQuery.graphql";
import { SpansTable } from "./SpansTable";

export function TracePage() {
  const data = useLazyLoadQuery<TracePageQuery>(
    graphql`
      query TracePageQuery {
        ...SpansTable_spans
      }
    `,
    {}
  );
  return (
    <main>
      <Alert variant="warning" banner>
        Tracing is under construction
      </Alert>
      <View padding="size-100">
        <Card bodyStyle={{ padding: 0 }} variant="compact" title="Spans">
          <Suspense>
            <SpansTable query={data} />
          </Suspense>
        </Card>
      </View>
    </main>
  );
}
