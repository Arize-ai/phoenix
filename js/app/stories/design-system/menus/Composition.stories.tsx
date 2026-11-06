import type { Meta, StoryObj } from "@storybook/react";
import {
  Autocomplete,
  Input,
  MenuSection,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";

import {
  Button,
  ColorSwatch,
  GridList,
  GridListItem,
  GridListSection,
  GridListSectionTitle,
  Icon,
  IconButton,
  Icons,
  Keyboard,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuSectionTitle,
  SearchField,
  Separator,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";

import { DATASET_LABELS, LABELS } from "../../constants/menuFixtures";
import {
  HeldOpenList,
  HeldOpenMenu,
  HeldOpenSubmenus,
  HoldSubmenuOpen,
} from "../../utils/HeldOpenMenu";
import { OptionGrid } from "../../utils/OptionGrid";

/**
 * What a `MenuContainer` holds besides its list: a `MenuHeader` above it
 * with a title, a search field or both, a `MenuFooter` below it, sections
 * inside it, and submenus beside it.
 *
 * Figma:
 * - MenuSectionTitle: https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=502-1375
 * - MenuHeaderTitle: https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=502-1365
 */
const meta = {
  title: "Design System/Menus/Composition",
  tags: ["updated", "unreviewed", "complete"],
  component: MenuHeader,
  subcomponents: {
    MenuHeaderTitle,
    MenuFooter,
    MenuSectionTitle,
    MenuSection,
    SubmenuTrigger,
  },
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
  },
} satisfies Meta<typeof MenuHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

function LabelSearch() {
  return (
    <SearchField aria-label="Search labels" variant="quiet">
      <SearchIcon />
      <Input placeholder="Search labels" />
    </SearchField>
  );
}

function LabelList({ selectedKeys }: { selectedKeys?: string[] }) {
  return (
    <HeldOpenList
      aria-label="Labels"
      items={LABELS.slice(0, 4)}
      selectionMode={selectedKeys ? "multiple" : "none"}
      selectedKeys={selectedKeys}
    >
      {({ id, name }) => <MenuItem id={id}>{name}</MenuItem>}
    </HeldOpenList>
  );
}

function CreateLabelButton() {
  return (
    <Button
      variant="quiet"
      size="S"
      aria-label="Create new label"
      leadingVisual={<Icon svg={<Icons.Plus />} />}
    />
  );
}

export const Default: Story = {
  tags: ["!dev"],
  render: function DefaultStory() {
    const { contains } = useFilter({ sensitivity: "base" });
    return (
      <HeldOpenMenu height={130} minHeight={0}>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <LabelSearch />
          </MenuHeader>
          <HeldOpenList
            aria-label="Labels"
            items={DATASET_LABELS}
            selectionMode="multiple"
            selectedKeys={["golden"]}
          >
            {({ id, color }) => (
              <MenuItem
                id={id}
                textValue={id}
                leadingContent={
                  <ColorSwatch color={color} size="M" shape="circle" />
                }
              >
                {id}
              </MenuItem>
            )}
          </HeldOpenList>
        </Autocomplete>
        <MenuFooter>
          <Button variant="quiet" size="S">
            Clear All
          </Button>
        </MenuFooter>
      </HeldOpenMenu>
    );
  },
};

export const Sections: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        { label: "Titled sections", height: 250 },
        { label: "Title trailing content", height: 130 },
      ]}
      alignRows="start"
      renderCell={(row) =>
        row.label === "Titled sections" ? (
          <HeldOpenMenu height={row.height} minHeight={0}>
            <HeldOpenList aria-label="Add evaluator">
              <MenuSection>
                <MenuSectionTitle title="New LLM evaluator" />
                <MenuItem>Create new</MenuItem>
                <MenuItem>Use template</MenuItem>
              </MenuSection>
              <Separator />
              <MenuSection>
                <MenuSectionTitle title="New code evaluator" />
                <MenuItem>Exact match</MenuItem>
                <MenuItem>Regex match</MenuItem>
              </MenuSection>
            </HeldOpenList>
          </HeldOpenMenu>
        ) : (
          <HeldOpenMenu height={row.height} minHeight={0}>
            <HeldOpenList
              aria-label="Edit approvals"
              selectionMode="single"
              selectedKeys={["manual"]}
            >
              <MenuSection>
                <MenuSectionTitle
                  title="Edit Approvals"
                  trailingContent={<Keyboard>Ctrl T</Keyboard>}
                />
                <MenuItem id="manual">Manual Approval</MenuItem>
                <MenuItem id="bypass">Bypass Approval</MenuItem>
              </MenuSection>
            </HeldOpenList>
          </HeldOpenMenu>
        )
      }
    />
  ),
};

function SearchableLabels({ withTitle }: { withTitle?: boolean }) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Autocomplete filter={contains}>
      <MenuHeader>
        {withTitle && (
          <MenuHeaderTitle trailingContent={<CreateLabelButton />}>
            Assign labels
          </MenuHeaderTitle>
        )}
        <LabelSearch />
      </MenuHeader>
      <LabelList selectedKeys={withTitle ? ["golden"] : undefined} />
    </Autocomplete>
  );
}

export const Headers: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        { label: "Title", height: 220 },
        { label: "Title leading and trailing content", height: 220 },
        { label: "Search", height: 220 },
        { label: "Title and search", height: 260 },
      ]}
      alignRows="start"
      renderCell={(row) => (
        <HeldOpenMenu height={row.height} minHeight={0}>
          {row.label === "Title" ? (
            <>
              <MenuHeader>
                <MenuHeaderTitle trailingContent={<CreateLabelButton />}>
                  Assign labels
                </MenuHeaderTitle>
              </MenuHeader>
              <LabelList selectedKeys={["golden"]} />
            </>
          ) : row.label === "Title leading and trailing content" ? (
            <>
              <MenuHeader>
                <MenuHeaderTitle
                  leadingContent={
                    <Button
                      variant="quiet"
                      size="S"
                      aria-label="Back to labels"
                      leadingVisual={<Icon svg={<Icons.ChevronLeftSmall />} />}
                    />
                  }
                  trailingContent={<CreateLabelButton />}
                >
                  Assign labels
                </MenuHeaderTitle>
              </MenuHeader>
              <LabelList selectedKeys={["golden"]} />
            </>
          ) : row.label === "Search" ? (
            <SearchableLabels />
          ) : (
            <SearchableLabels withTitle />
          )}
        </HeldOpenMenu>
      )}
    />
  ),
};

export const Submenu: Story = {
  tags: ["!dev"],
  render: () => (
    <HeldOpenMenu height={200} width={640} minHeight={0}>
      {(boundaryElement) => (
        <HeldOpenSubmenus>
          <HeldOpenList aria-label="Dataset actions">
            <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
              Edit
            </MenuItem>
            <SubmenuTrigger>
              <MenuItem
                id="label"
                leadingContent={<Icon svg={<Icons.PriceTags />} />}
              >
                <HoldSubmenuOpen itemId="label" />
                Label
              </MenuItem>
              <MenuContainer minHeight={0} boundaryElement={boundaryElement}>
                <HeldOpenList
                  aria-label="Labels"
                  items={DATASET_LABELS}
                  selectionMode="multiple"
                  selectedKeys={["golden"]}
                >
                  {({ id, color }) => (
                    <MenuItem
                      id={id}
                      textValue={id}
                      leadingContent={
                        <ColorSwatch color={color} size="M" shape="circle" />
                      }
                    >
                      {id}
                    </MenuItem>
                  )}
                </HeldOpenList>
              </MenuContainer>
            </SubmenuTrigger>
            <MenuItem
              id="delete"
              leadingContent={<Icon svg={<Icons.Trash />} />}
            >
              Delete
            </MenuItem>
          </HeldOpenList>
        </HeldOpenSubmenus>
      )}
    </HeldOpenMenu>
  ),
  parameters: { themeLayout: "column" },
};

const EVALUATORS = ["correctness", "hallucination", "qa-relevance"];

export const GridListAndMenu: Story = {
  tags: ["!dev"],
  render: () => (
    <HeldOpenMenu height={330} minHeight={0}>
      <GridList
        aria-label="Select evaluators"
        selectionMode="multiple"
        defaultSelectedKeys={["correctness"]}
      >
        <GridListSection>
          <GridListSectionTitle title="Evaluators" />
          {EVALUATORS.map((name) => (
            <GridListItem
              key={name}
              id={name}
              textValue={name}
              trailingContent={
                <IconButton size="S" aria-label="Edit evaluator">
                  <Icon svg={<Icons.Edit />} />
                </IconButton>
              }
            >
              {name}
            </GridListItem>
          ))}
        </GridListSection>
      </GridList>
      <Separator />
      <HeldOpenList aria-label="Add evaluator">
        <MenuSection>
          <MenuSectionTitle title="New evaluator" />
          <MenuItem>Create new</MenuItem>
          <MenuItem>Use template</MenuItem>
        </MenuSection>
      </HeldOpenList>
    </HeldOpenMenu>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ alignSelf: "flex-start", width: "100%" }}>
      <HeldOpenMenu height={180} width={240} minHeight={0} minWidth={220}>
        <SearchableLabels withTitle />
      </HeldOpenMenu>
    </div>
  ),
};
