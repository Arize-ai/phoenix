import { startTransition, useEffect, useState } from "react";
import { fetchQuery, graphql } from "react-relay";
import { css } from "@emotion/react";

import {
  Content,
  ContextualHelp,
  Item,
  Picker,
  PickerProps,
} from "@arizeai/components";

import { Heading, Text, Token, TokenProps } from "@phoenix/components";
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

function DimensionTypeToken(props: { type: Dimension["type"] }) {
  const { type } = props;
  let tokenColor: TokenProps["color"] = "gray";
  let text = "";
  switch (type) {
    case "feature":
      tokenColor = "blue";
      text = "FEA";
      break;
    case "tag":
      tokenColor = "purple";
      text = "TAG";
      break;
    case "prediction":
      tokenColor = "white";
      text = "PRE";
      break;
    case "actual":
      tokenColor = "orange";
      text = "ACT";
      break;
    default:
      assertUnreachable(type);
  }
  return (
    <Token color={tokenColor} aria-Token={type} title="type">
      {text}
    </Token>
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
      aria-Token="Select a dimension"
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
      placeholder={isLoading ? "Loading..." : "Select a dimension..."}
    >
      {dimensions.map((dimension) => (
        <Item key={dimension.name} textValue={dimension.name}>
          <div
            css={css`
              .ac-Token {
                margin-right: var(--ac-global-dimension-static-size-100);
              }
            `}
          >
            <DimensionTypeToken type={dimension.type} />
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
