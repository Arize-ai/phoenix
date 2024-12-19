import React, { useEffect, useMemo } from "react";
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";

import { ComboBox, ComboBoxItem, ComboBoxProps } from "@phoenix/components";

import promptComboBoxQuery, {
  PromptComboBoxQuery,
} from "./__generated__/PromptComboBoxQuery.graphql";

export type PromptItem =
  PromptComboBoxQuery["response"]["prompts"]["edges"][number]["prompt"];

type PromptComboBoxProps = {
  onChange: (promptId: string | null) => void;
  promptId?: string | null;
  container?: HTMLElement;
} & Omit<
  ComboBoxProps<PromptItem>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

function PromptComboBoxComponent({
  onChange,
  container,
  promptId,
  queryReference,
  ...comboBoxProps
}: PromptComboBoxProps & {
  queryReference: PreloadedQuery<PromptComboBoxQuery>;
}) {
  const data = usePreloadedQuery(
    graphql`
      query PromptComboBoxQuery($first: Int = 100) {
        prompts(first: $first) {
          edges {
            prompt: node {
              __typename
              ... on Prompt {
                id
                name
              }
            }
          }
        }
      }
    `,
    queryReference
  );
  const items = useMemo((): PromptItem[] => {
    return data.prompts.edges.map((edge) => edge.prompt);
  }, [data.prompts.edges]);

  return (
    <ComboBox
      size="M"
      data-testid="prompt-picker"
      selectedKey={promptId ?? null}
      aria-label="prompt picker"
      width="100%"
      menuTrigger="focus"
      stopPropagation
      container={container}
      defaultItems={items}
      placeholder="Select a prompt..."
      onSelectionChange={(key) => {
        if (typeof key !== "string" && key != null) {
          return;
        }
        if (key === promptId) {
          onChange(null);
          return;
        }
        onChange(key);
      }}
      {...comboBoxProps}
    >
      {(item) => {
        return (
          <ComboBoxItem key={item.id} textValue={item.name} id={item.id}>
            {item.name}
          </ComboBoxItem>
        );
      }}
    </ComboBox>
  );
}

function PromptComboBoxLoader(props: PromptComboBoxProps) {
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<PromptComboBoxQuery>(promptComboBoxQuery);

  useEffect(() => {
    // TODO(apowell): Paginate and filter in query
    loadQuery({ first: 100 });
    return () => disposeQuery();
  }, [disposeQuery, loadQuery]);

  return queryReference != null ? (
    <PromptComboBoxComponent queryReference={queryReference} {...props} />
  ) : null;
}

export function PromptComboBox(props: PromptComboBoxProps) {
  return <PromptComboBoxLoader {...props} />;
}
