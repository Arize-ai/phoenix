import React from "react";

import { Alert, Flex, View } from "@arizeai/components";

import { Link } from "@phoenix/components";

export function ProjectsPage() {
  return (
    <Flex direction="column" flex="1 1 auto">
      <Alert variant="info" banner title="🚧 Under Construction">
        Projects are currently under construction. Navigate to your{" "}
        <Link to="/projects/default">default project</Link>
      </Alert>
      <View padding="size-200">
        <Link to="/projects/default">Go to your default project</Link>
      </View>
    </Flex>
  );
}
