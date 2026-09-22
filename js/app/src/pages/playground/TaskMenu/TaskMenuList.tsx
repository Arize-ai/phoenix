import { css } from "@emotion/react";
import { Header, ListBoxSection } from "react-aria-components";

import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  ListBox,
  Loading,
  SelectItem,
  Text,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";

import {
  searchablePickerListCSS,
  searchablePickerMenuCSS,
} from "../searchablePickerStyles";
import type { TaskMenuSection } from "./taskMenuItems";

const taskListCSS = css`
  .react-aria-ListBoxSection:not(:first-of-type) {
    margin-top: var(--global-dimension-size-50);
    padding-top: var(--global-dimension-size-50);
    border-top: 1px solid var(--global-border-color-default);
  }

  .react-aria-Header {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-150) 0;
  }
`;

/**
 * The searchable, sectioned list both task menus open: the one on each
 * task and the Compare menu. It must sit inside a Select's Popover, which
 * owns the selection.
 */
export function TaskMenuList({
  sections,
  search,
  onSearchChange,
  isLoading,
  note,
}: {
  sections: TaskMenuSection[];
  search: string;
  onSearchChange: (search: string) => void;
  isLoading: boolean;
  /** One line above the list, e.g. why the kind cannot change. */
  note?: string | null;
}) {
  return (
    <div css={searchablePickerMenuCSS}>
      <View padding="size-100" flex="none">
        <DebouncedSearch
          aria-label="Search tasks"
          defaultValue={search}
          onChange={onSearchChange}
          placeholder="Search prompts and evaluators"
        />
      </View>
      {note ? (
        <View paddingX="size-150" paddingBottom="size-100" flex="none">
          <Text size="XS" color="text-500">
            {note}
          </Text>
        </View>
      ) : null}
      {isLoading ? <Loading size="S" /> : null}
      <ListBox css={css(searchablePickerListCSS, taskListCSS)}>
        {sections.map((section) => (
          // Collection keys are shared by sections and items, so a section
          // must not be named like one of its items.
          <ListBoxSection key={section.id} id={`section:${section.id}`}>
            {section.title ? (
              <Header>
                <Text size="XS" weight="heavy" color="text-500">
                  {section.title}
                </Text>
              </Header>
            ) : null}
            {section.items.map((item) => (
              <SelectItem key={item.key} id={item.key} textValue={item.label}>
                <Flex
                  direction="row"
                  gap="size-100"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    {item.isAction ? <Icon svg={<Icons.PlusCircle />} /> : null}
                    <Truncate maxWidth="30ch" title={item.label}>
                      {item.label}
                    </Truncate>
                  </Flex>
                  {item.evaluatorKind && !item.isAction ? (
                    <EvaluatorKindToken kind={item.evaluatorKind} size="S" />
                  ) : null}
                </Flex>
              </SelectItem>
            ))}
          </ListBoxSection>
        ))}
      </ListBox>
    </div>
  );
}
