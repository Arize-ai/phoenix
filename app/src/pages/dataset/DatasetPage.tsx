import React, { Suspense } from "react";

import { Flex, Heading, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";

export function DatasetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DatasetPageContent />
    </Suspense>
  );
}

function DatasetPageContent() {
  return (
    <div>
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>Dataset</Heading>
        </Flex>
      </View>
    </div>
  );
}
