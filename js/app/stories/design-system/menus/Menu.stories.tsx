import type { Meta, StoryObj } from "@storybook/react";
import {
  Autocomplete,
  Input,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";

import { LABELS, MANY_PROJECTS, SPLITS } from "../../constants/menuFixtures";
import { HeldOpenList, HeldOpenMenu } from "../../utils/HeldOpenMenu";
import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The list of items inside a menu. It owns the selection mode and the
 * empty state. Each item's content and states belong to `Menu Item`, and
 * the surface the list sits on, with its size and placement, belongs to
 * `Menu Container`.
 *
 * Every story but `Interaction` holds its menu open, and nothing on the
 * page closes it, so the cases can be compared side by side and in both
 * themes.
 *
 * Figma: https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=492-1718
 */
const meta = {
  title: "Design System/Menus/Menu",
  tags: ["updated", "unreviewed", "complete"],
  component: Menu,
  subcomponents: { MenuTrigger },
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=492-1718",
    },
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

function DatasetActionItems() {
  return (
    <>
      <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
        Edit
      </MenuItem>
      <MenuItem
        id="duplicate"
        leadingContent={<Icon svg={<Icons.Duplicate />} />}
      >
        Duplicate
      </MenuItem>
      <MenuItem id="delete" leadingContent={<Icon svg={<Icons.Trash />} />}>
        Delete
      </MenuItem>
    </>
  );
}

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <HeldOpenMenu height={130} minHeight={0}>
      <HeldOpenList aria-label="Dataset actions">
        <DatasetActionItems />
      </HeldOpenList>
    </HeldOpenMenu>
  ),
};

export const SelectionModes: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        { label: "none", code: true, selected: [] },
        { label: "single", code: true, selected: ["validation"] },
        { label: "multiple", code: true, selected: ["train", "test"] },
      ]}
      alignRows="start"
      renderCell={(row) => (
        <HeldOpenMenu height={170} minHeight={0}>
          <HeldOpenList
            aria-label="Splits"
            items={SPLITS}
            selectionMode={row.label as "none" | "single" | "multiple"}
            selectedKeys={row.selected}
          >
            {({ id, name }) => <MenuItem id={id}>{name}</MenuItem>}
          </HeldOpenList>
        </HeldOpenMenu>
      )}
    />
  ),
};

const MANY_ITEMS = [
  { label: "25 items", items: LABELS },
  { label: "250 items", items: MANY_PROJECTS },
];

function LabelMenu({
  items,
  height,
}: {
  items: { id: string; name: string }[];
  height: number;
}) {
  return (
    <HeldOpenMenu height={height}>
      <HeldOpenList
        aria-label="Labels"
        items={items}
        renderEmptyState={() => (
          <CompactEmptyState
            icon={<Icon svg={<Icons.PriceTags />} />}
            description="No labels"
          />
        )}
      >
        {({ id, name }) => <MenuItem id={id}>{name}</MenuItem>}
      </HeldOpenList>
    </HeldOpenMenu>
  );
}

export const ContentLength: Story = {
  tags: ["!dev"],
  render: () => (
    <Flex direction="column" gap="size-300">
      <LabelMenu items={[]} height={370} />
      <Flex direction="row" gap="size-300">
        <LabelMenu items={LABELS.slice(0, 1)} height={370} />
        <LabelMenu items={LABELS.slice(0, 5)} height={370} />
      </Flex>
      <OptionGrid
        columns={MANY_ITEMS}
        renderCell={(_, column) => (
          <LabelMenu items={column?.items ?? []} height={650} />
        )}
      />
    </Flex>
  ),
  parameters: { themeLayout: "column" },
};

function LabelSearch() {
  return (
    <SearchField aria-label="Search labels" variant="quiet">
      <SearchIcon />
      <Input placeholder="Search labels" />
    </SearchField>
  );
}

export const Interaction: Story = {
  tags: ["!dev"],
  render: function InteractionStory() {
    const { contains } = useFilter({ sensitivity: "base" });
    return (
      <MenuTrigger>
        <Button
          size="S"
          aria-label="Dataset actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <MenuContainer>
          <Menu aria-label="Dataset actions">
            <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
              Edit
            </MenuItem>
            <SubmenuTrigger>
              <MenuItem
                id="label"
                leadingContent={<Icon svg={<Icons.PriceTags />} />}
              >
                Label
              </MenuItem>
              <MenuContainer>
                <Autocomplete filter={contains}>
                  <MenuHeader>
                    <LabelSearch />
                  </MenuHeader>
                  <Menu
                    aria-label="Labels"
                    items={LABELS}
                    selectionMode="multiple"
                  >
                    {({ id, name }) => <MenuItem id={id}>{name}</MenuItem>}
                  </Menu>
                </Autocomplete>
              </MenuContainer>
            </SubmenuTrigger>
            <MenuItem
              id="delete"
              leadingContent={<Icon svg={<Icons.Trash />} />}
            >
              Delete
            </MenuItem>
          </Menu>
        </MenuContainer>
      </MenuTrigger>
    );
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ alignSelf: "flex-start", width: "100%" }}>
      <HeldOpenMenu height={130} width={200} minHeight={0} minWidth={180}>
        <HeldOpenList aria-label="Dataset actions">
          <DatasetActionItems />
        </HeldOpenList>
      </HeldOpenMenu>
    </div>
  ),
};
