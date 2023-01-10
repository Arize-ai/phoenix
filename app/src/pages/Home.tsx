/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

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
