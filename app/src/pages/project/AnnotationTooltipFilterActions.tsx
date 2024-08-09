import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Text, View } from "@arizeai/components";

type AnnotationTooltipFilterActionsProps = {
  annotation: {
    name: string;
    label: string | null;
    score: number | null;
  };
};

export function AnnotationTooltipFilterActions(
  _props: AnnotationTooltipFilterActionsProps
) {
  return (
    <View
      borderStartWidth="thin"
      borderColor="dark"
      paddingStart="size-200"
      paddingEnd="size-100"
      marginStart="size-200"
      width={300}
    >
      <Text textSize="large" weight="heavy">
        Filters
      </Text>

      <ul
        css={css`
          display: flex;
          flex-direction: row;
          gap: var(--ac-global-dimension-size-100);
          color: var(--ac-global-color-primary);
          padding: var(--ac-global-dimension-size-100) 0;
          flex-wrap: wrap;
        `}
      >
        <li>
          <FilterItem onClick={() => {}}>Match label</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Exclude label</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Greater than score</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Less than score</FilterItem>
        </li>
        <li>
          <FilterItem onClick={() => {}}>Equals score</FilterItem>
        </li>
      </ul>
    </View>
  );
}

function FilterItem(props: PropsWithChildren<{ onClick: () => void }>) {
  return (
    <button
      onClick={props.onClick}
      className="button--reset"
      css={css`
        color: var(--ac-global-text-color-900);
        border: 1px solid var(--ac-global-color-gray-200);
        border-radius: 4px;
        padding: var(--ac-global-dimension-size-50)
          var(--ac-global-dimension-size-100);
        cursor: pointer;
        transition: background-color 0.2s;
        &:hover {
          background-color: var(--ac-global-color-gray-300);
        }
      `}
    >
      {props.children}
    </button>
  );
}
