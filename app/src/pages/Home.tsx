import { css } from "@emotion/react";
import { Card } from "@arizeai/components";
import React from "react";

type HomePageProps = {
  primaryDatasetName: string;
  referenceDatasetName: string;
};
export function Home(props: HomePageProps) {
  const { primaryDatasetName, referenceDatasetName } = props;
  return (
    <main
      css={(theme) =>
        css`
          margin: ${theme.spacing.margin8}px;
        `
      }
    >
      <Card
        title="Model Schema"
        subTitle={`primary: ${primaryDatasetName}, reference: ${referenceDatasetName}`}
        variant="compact"
      >
        Schema here
      </Card>
    </main>
  );
}
