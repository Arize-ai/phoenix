import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { ComboBox, ComboBoxItem, ComboBoxProps } from "@phoenix/components";

import { PromptComboBoxQuery } from "./__generated__/PromptComboBoxQuery.graphql";

export type PromptItem =
  PromptComboBoxQuery["response"]["prompts"]["edges"][number]["prompt"];

type PromptComboBoxProps = {
  onChange: (promptId: string | null) => void;
  promptId?: string | null;
} & Omit<
  ComboBoxProps<PromptItem>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function PromptComboBox({
  onChange,
  container,
  promptId,
  ...comboBoxProps
}: PromptComboBoxProps) {
  const data = useLazyLoadQuery<PromptComboBoxQuery>(
    graphql`
      query PromptComboBoxQuery {
        prompts {
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
    {},
    { fetchPolicy: "store-and-network", fetchKey: promptId ?? undefined }
  );
  const prompts = data.prompts.edges;
  const items = useMemo(() => {
    return prompts.map((edge) => edge.prompt);
  }, [prompts]);

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
      renderEmptyState={() => <div>No prompts found</div>}
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
