import React, { startTransition, useEffect, useState } from "react";
import { fetchQuery, graphql } from "react-relay";
import { css } from "@emotion/react";

import {
  Content,
  ContextualHelp,
  Heading,
  Item,
  Label,
  LabelProps,
  Picker,
  PickerProps,
  Text,
} from "@arizeai/components";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { Dimension } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import { DimensionPickerQuery } from "./__generated__/DimensionPickerQuery.graphql";

type DimensionPickerProps<T> = Omit<
  PickerProps<T>,
  "onSelectionChange" | "children"
> & {
  selectedDimension: Dimension | null;
  onChange: (dimension: Dimension) => void;
  dimensions: Dimension[];
  /**
   * Boolean flag to indicate if the picker is loading data
   * @default false
   */
  isLoading?: boolean;
};

function DimensionTypeLabel(props: { type: Dimension["type"] }) {
  const { type } = props;
  let labelColor: LabelProps["color"] = "gray";
  let text = "";
  switch (type) {
    case "feature":
      labelColor = "blue";
      text = "FEA";
      break;
    case "tag":
      labelColor = "purple";
      text = "TAG";
      break;
    case "prediction":
      labelColor = "white";
      text = "PRE";
      break;
    case "actual":
      labelColor = "orange";
      text = "ACT";
      break;
    default:
      assertUnreachable(type);
  }
  return (
    <Label color={labelColor} aria-label={type} title="type">
      {text}
    </Label>
  );
}

const contextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Model Dimension
    </Heading>
    <Content>
      <Text>
        A dimension is a feature, tag, prediction, or actual value that is
        associated with a model inference. Features represent inputs, tags
        represent metadata, predictions represent outputs, and actuals represent
        ground truth.
      </Text>
    </Content>
  </ContextualHelp>
);

export function DimensionPicker<T>(props: DimensionPickerProps<T>) {
  const { selectedDimension, dimensions, onChange, isLoading, ...restProps } =
    props;
  return (
    <Picker
      {...restProps}
      defaultSelectedKey={
        selectedDimension ? selectedDimension.name : undefined
      }
      aria-label="Select a dimension"
      onSelectionChange={(key) => {
        // Find the dimension in the list
        const dimension = dimensions.find((d) => d.name === key);
        if (dimension) {
          startTransition(() => onChange(dimension));
        }
      }}
      label="Dimension"
      labelExtra={contextualHelp}
      isDisabled={isLoading}
      placeholder={isLoading ? "Loading..." : "Select a dimension"}
    >
      {dimensions.map((dimension) => (
        <Item key={dimension.name} textValue={dimension.name}>
          <div
            css={css`
              .ac-label {
                margin-right: var(--px-spacing-med);
              }
            `}
          >
            <DimensionTypeLabel type={dimension.type} />
            {dimension.name}
          </div>
        </Item>
      ))}
    </Picker>
  );
}

type ConnectedDimensionPickerProps<T> = Omit<
  DimensionPickerProps<T>,
  "dimensions"
>;

export function ConnectedDimensionPicker<T>(
  props: ConnectedDimensionPickerProps<T>
) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { selectedDimension, onChange, ...restProps } = props;

  // Async load the dimensions
  useEffect(() => {
    fetchQuery<DimensionPickerQuery>(
      RelayEnvironment,
      graphql`
        query DimensionPickerQuery {
          model {
            dimensions {
              edges {
                node {
                  id
                  name
                  type
                  dataType
                }
              }
            }
          }
        }
      `,
      {},
      {
        fetchPolicy: "store-or-network",
      }
    )
      .toPromise()
      .then((data) => {
        const dims: Dimension[] =
          data?.model.dimensions.edges.map((edge) => edge.node) ?? [];
        setDimensions(dims);
        setIsLoading(false);
      });
  }, []);

  return (
    <DimensionPicker
      {...restProps}
      onChange={onChange}
      dimensions={dimensions}
      label="Dimension"
      selectedDimension={selectedDimension}
      isLoading={isLoading}
    />
  );
}
