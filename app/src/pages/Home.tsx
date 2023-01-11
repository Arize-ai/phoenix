import { css } from "@emotion/react";
import { Card } from "@arizeai/components";
import { ModelSchemaTable } from "../components/model";
import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { HomeQuery } from "./__generated__/HomeQuery.graphql";

type HomePageProps = {
  primaryDatasetName: string;
  referenceDatasetName: string;
};

export function Home(props: HomePageProps) {
  const { primaryDatasetName, referenceDatasetName } = props;
  const data = useLazyLoadQuery<HomeQuery>(
    graphql`
      query HomeQuery {
        ...ModelSchemaTable_dimensions
      }
    `,
    {}
  );
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
        bodyStyle={{
          padding: 0,
        }}
      >
        <ModelSchemaTable model={data} />
      </Card>
    </main>
  );
}
