import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";

import { RunDatasetExperimentButton } from "../dataset/RunDatasetExperimentButton";

export function ExperimentsEmpty() {
  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="experiment" />}
        description="Run experiments to evaluate and improve your AI applications."
        action={{
          type: "strip",
          items: [
            {
              kind: "link",
              label: "Docs",
              href: "https://docs.arize.com/phoenix/datasets-and-experiments/how-to-experiments/run-experiments",
            },
            {
              kind: "link",
              label: "Example",
              href: "https://docs.arize.com/phoenix/cookbook/datasets-and-experiments/summarization",
            },
            {
              kind: "node",
              node: <RunDatasetExperimentButton variant="primary" />,
            },
          ],
        }}
      />
    </EmptyStateArea>
  );
}
