import { graphql, useFragment } from "react-relay";

import { Content, ContextualHelp } from "@arizeai/components";

import { ExternalLink, Flex, Heading, Text } from "@phoenix/components";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionDriftStats_dimension$key } from "./__generated__/DimensionDriftStats_dimension.graphql";

const contextualHelp = (
  <ContextualHelp variant="info" placement="top end">
    <Heading weight="heavy" level={4}>
      Population Stability Index
    </Heading>
    <Content>
      <Text>
        PSI is a symmetric metric that measures the relative entropy, or
        difference in information represented by two distributions. It can be
        thought of as measuring the distance between two data distributions
        showing how different the two distributions are from each other.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://arize.com/blog-course/population-stability-index-psi/#:~:text=Population%20Stability%20Index%20(PSI)%20Overview,distributions%20are%20from%20each%20other.">
        Learn more
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

export function DimensionDriftStats(props: {
  dimension: DimensionDriftStats_dimension$key;
}) {
  const data = useFragment<DimensionDriftStats_dimension$key>(
    graphql`
      fragment DimensionDriftStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        psi: driftMetric(metric: psi, timeRange: $timeRange)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Flex direction="row" alignItems="center" gap="size-25">
        <Text elementType="h3" size="XS" color="text-700">
          PSI
        </Text>
        {contextualHelp}
      </Flex>
      <Text size="L">{floatFormatter(data.psi)}</Text>
    </>
  );
}
