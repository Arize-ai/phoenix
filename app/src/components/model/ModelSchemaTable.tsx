import React from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { ModelSchemaTable_dimensions$key } from "./__generated__/ModelSchemaTable_dimensions.graphql";

type ModelSchemaTableProps = {
  model: ModelSchemaTable_dimensions$key;
};

export function ModelSchemaTable(props: ModelSchemaTableProps) {
  const { data } = usePaginationFragment(
    graphql`
      fragment ModelSchemaTable_dimensions on Query
      @refetchable(queryName: "ModelSchemaTableDimensionsQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 50 }
        cursor: { type: "String", defaultValue: null }
      ) {
        model {
          dimensions(first: $count, after: $cursor)
            @connection(key: "ModelSchemaTable_dimensions") {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `,
    props.model
  );
  const dimensions = data.model.dimensions.edges.map((edge) => edge.node);
  return (
    <ul>
      {dimensions.map((d, index) => (
        <li key={index}>{d.name}</li>
      ))}
    </ul>
  );
}
