import { EmptyState, EmptyStateGraphic } from "@phoenix/components/empty-state";

export function DatasetsEmpty() {
  return (
    <EmptyState
      graphic={<EmptyStateGraphic variant="dataset" />}
      description="Create datasets for testing prompts, experimentation, and fine-tuning."
      action={{
        type: "strip",
        items: [
          {
            kind: "link",
            label: "Docs",
            href: "https://arize.com/docs/phoenix/datasets-and-experiments/how-to-datasets",
          },
          {
            kind: "link",
            label: "Quickstart",
            href: "https://arize.com/docs/phoenix/get-started/get-started-datasets-and-experiments",
          },
        ],
      }}
    />
  );
}
