import { css } from "@emotion/react";
import { Header, ListBoxSection } from "react-aria-components";

import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  ListBox,
  Loading,
  SegmentedControl,
  SegmentedControlItem,
  SelectItem,
  Text,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import type { PlaygroundTaskKind } from "@phoenix/store/playground";

import {
  searchablePickerListCSS,
  searchablePickerMenuCSS,
} from "../searchablePickerStyles";
import type { TaskMenuSection, TaskMenuTab } from "./taskMenuItems";

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
 * The searchable list both task menus open: the one on each task and the
 * Compare menu. One tab per kind of task the menu offers — the saved items
 * of that kind, then its "New" actions — with the search scoped to the tab;
 * a menu offering one kind shows that kind's list without a tab strip. It
 * must sit inside a Select's Popover, which owns the selection.
 *
 * The tabs are a segmented control rather than Tabs: the Select renders its
 * popover once more, hidden, to build its collection, and a Tabs panel in
 * that pass has no tab state to read.
 */
export function TaskMenuList({
  tabs,
  selectedKind,
  onSelectedKindChange,
  leadingSections = [],
  search,
  onSearchChange,
  isLoading,
  note,
}: {
  tabs: TaskMenuTab[];
  /** The tab shown; falls back to the first when it is not among `tabs`. */
  selectedKind: PlaygroundTaskKind;
  onSelectedKindChange?: (kind: PlaygroundTaskKind) => void;
  /** Sections ahead of every tab's list, e.g. the Compare menu's duplicate. */
  leadingSections?: TaskMenuSection[];
  search: string;
  onSearchChange: (search: string) => void;
  isLoading: boolean;
  /** One line above the list, e.g. why the kind cannot change. */
  note?: string | null;
}) {
  const selected = tabs.find((tab) => tab.kind === selectedKind) ?? tabs[0];

  const body = (
    <TaskMenuListBody
      sections={[...leadingSections, ...(selected?.sections ?? [])]}
      placeholder={`Search ${selected?.title.toLowerCase() ?? "tasks"}`}
      search={search}
      onSearchChange={onSearchChange}
      isLoading={isLoading}
      note={note}
    />
  );

  return (
    <div css={searchablePickerMenuCSS}>
      {tabs.length > 1 ? (
        <View paddingX="size-100" paddingTop="size-100" flex="none">
          <SegmentedControl
            aria-label="Kind of task"
            size="S"
            isJustified
            selectedKey={selected.kind}
            onSelectionChange={(key) =>
              onSelectedKindChange?.(key as PlaygroundTaskKind)
            }
          >
            {tabs.map((tab) => (
              <SegmentedControlItem key={tab.kind} id={tab.kind}>
                {tab.title}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </View>
      ) : null}
      {body}
    </div>
  );
}

/** The search field, the note, and the sectioned list under it. */
function TaskMenuListBody({
  sections,
  placeholder,
  search,
  onSearchChange,
  isLoading,
  note,
}: {
  sections: TaskMenuSection[];
  placeholder: string;
  search: string;
  onSearchChange: (search: string) => void;
  isLoading: boolean;
  note?: string | null;
}) {
  return (
    <>
      <View padding="size-100" flex="none">
        <DebouncedSearch
          aria-label="Search tasks"
          defaultValue={search}
          onChange={onSearchChange}
          placeholder={placeholder}
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
    </>
  );
}
