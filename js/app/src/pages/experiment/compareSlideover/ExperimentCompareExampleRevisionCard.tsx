import { graphql, useLazyLoadQuery } from "react-relay";

import { Card, CopyToClipboardButton } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

import type { ExperimentCompareExampleRevisionCardQuery } from "./__generated__/ExperimentCompareExampleRevisionCardQuery.graphql";

type ExampleRevisionField = "input" | "referenceOutput";

const TITLES_BY_FIELD: Record<ExampleRevisionField, string> = {
  input: "Input",
  referenceOutput: "Reference Output",
};

/**
 * The example's input or reference output, which every experiment shares.
 * Both cards read one query, so they load together.
 */
export function ExperimentCompareExampleRevisionCard({
  exampleId,
  datasetVersionId,
  field,
}: {
  exampleId: string;
  datasetVersionId: string;
  field: ExampleRevisionField;
}) {
  const data = useLazyLoadQuery<ExperimentCompareExampleRevisionCardQuery>(
    graphql`
      query ExperimentCompareExampleRevisionCardQuery(
        $exampleId: ID!
        $datasetVersionId: ID!
      ) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            revision(datasetVersionId: $datasetVersionId) {
              input
              referenceOutput: output
            }
          }
        }
      }
    `,
    { exampleId, datasetVersionId }
  );
  const valueText = JSON.stringify(data.example.revision?.[field], null, 2);
  return (
    <Card
      title={TITLES_BY_FIELD[field]}
      subTitle="shared by all experiments"
      extra={<CopyToClipboardButton text={valueText} />}
    >
      <JSONBlock value={valueText} />
    </Card>
  );
}
