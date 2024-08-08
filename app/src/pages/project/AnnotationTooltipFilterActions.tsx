import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, View } from "@arizeai/components";

type AnnotationTooltipFilterActionsProps = {
  annotation: {
    name: string;
    label: string | null;
    score: number | null;
  };
};

export function AnnotationTooltipFilterActions(
  props: AnnotationTooltipFilterActionsProps
) {
  return (
    <View
      borderStartWidth="thin"
      borderColor="dark"
      paddingStart="size-200"
      paddingEnd="size-100"
      marginStart="size-200"
      width={150}
    >
      <Flex direction="row" gap="size-50">
        <Icon svg={<Icons.SearchOutline />} />
        <Text textSize="large" weight="heavy">
          filters
        </Text>
      </Flex>
      <ul
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-size-100);
          color: var(--ac-global-color-primary);
        `}
      >
        <li>
          <FilterItem onClick={() => {}}>Include label</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Exclude label</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Greater than</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Less than</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Equals</FilterItem>
        </li>
      </ul>
    </View>
  );
}

function FilterItem(props: PropsWithChildren<{ onClick: () => void }>) {
  return (
    <a
      onClick={props.onClick}
      css={css`
        padding: var(--ac-global-dimension-size-50);
        border-radius: var(--ac-global-dimension-size-50);
        :hover {
          background-color: var(--ac-global-color-gray-200);
        }
      `}
    >
      {props.children}
    </a>
  );
}
