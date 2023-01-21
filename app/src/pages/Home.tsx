import { css } from "@emotion/react";
import { Card } from "@arizeai/components";
import { ModelSchemaTable } from "../components/model";
import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { HomeQuery } from "./__generated__/HomeQuery.graphql";

type HomePageProps = Readonly<object>;

export function Home(_props: HomePageProps) {
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
