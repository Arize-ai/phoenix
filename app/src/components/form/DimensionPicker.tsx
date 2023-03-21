import React, { startTransition, useEffect, useState } from "react";
import { fetchQuery, graphql } from "react-relay";

import { Item, Picker, PickerProps } from "@arizeai/components";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { Dimension } from "@phoenix/types";

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
      isDisabled={isLoading}
      placeholder={isLoading ? "Loading..." : "Select a dimension"}
    >
      {dimensions.map((dimension) => (
        <Item key={dimension.name}>{dimension.name}</Item>
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
      {}
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
