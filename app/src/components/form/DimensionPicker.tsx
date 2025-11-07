import { startTransition, useEffect, useState } from "react";
import { fetchQuery, graphql } from "react-relay";

import {
  Button,
  ContextualHelp,
  Flex,
  Heading,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  Token,
  TokenProps,
} from "@phoenix/components";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { Dimension } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import { DimensionPickerQuery } from "./__generated__/DimensionPickerQuery.graphql";

type DimensionPickerProps = {
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
    <Text>
      A dimension is a feature, tag, prediction, or actual value that is
      associated with a model inference. Features represent inputs, tags
      represent metadata, predictions represent outputs, and actuals represent
      ground truth.
    </Text>
  </ContextualHelp>
);

export function DimensionPicker(props: DimensionPickerProps) {
  const { selectedDimension, dimensions, onChange, isLoading } = props;
  return (
    <div>
      <Flex direction="row" alignItems="center" gap="size-25">
        <Label>Dimension</Label>
        {contextualHelp}
      </Flex>
      <Select
        defaultValue={selectedDimension ? selectedDimension.name : undefined}
        aria-label="Select a dimension"
        onChange={(key) => {
          // Find the dimension in the list
          const dimension = dimensions.find((d) => d.name === key);
          if (dimension) {
            startTransition(() => onChange(dimension));
          }
        }}
        isDisabled={isLoading}
        data-testid="dimension-picker"
      >
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            {dimensions.map((dimension) => (
              <SelectItem key={dimension.name} id={dimension.name}>
                <Flex direction="row" alignItems="center" gap="size-100">
                  <DimensionTypeToken type={dimension.type} />
                  {dimension.name}
                </Flex>
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
    </div>
  );
}

type ConnectedDimensionPickerProps = Omit<DimensionPickerProps, "dimensions">;

export function ConnectedDimensionPicker(props: ConnectedDimensionPickerProps) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { selectedDimension, onChange } = props;

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
      onChange={onChange}
      dimensions={dimensions}
      selectedDimension={selectedDimension}
      isLoading={isLoading}
    />
  );
}
