import { useMemo, useState } from "react";
import {
  Autocomplete,
  Collection,
  Header,
  Input,
  MenuSection,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";
import { Meta } from "@storybook/react";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Separator,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

const meta: Meta<typeof Menu> = {
  title: "Menu",
  component: Menu,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const NESTED_MENU_ITEMS = [
  {
    id: "1",
    name: "Item 1 Group",
    children: [
      {
        id: "1.1",
        name: "Item 1.1",
      },
    ],
  },
  {
    id: "2",
    name: "Item 2 Group",
  },
  {
    id: "3",
    name: "Item 3 Group",
    children: [
      {
        id: "3.1",
        name: "Item 3.1",
      },
      {
        id: "3.2",
        name: "Item 3.2",
      },
      {
        id: "3.3",
        name: "Item 3.3 Group",
        children: [
          {
            id: "3.3.1",
            name: "Item 3.3.1",
          },
        ],
      },
    ],
  },
];

export const Template = () => {
  return (
    <MenuTrigger>
      <Button>Open Menu</Button>
      <Popover>
        <Menu>
          <MenuItem>Item 1</MenuItem>
          <MenuItem>Item 2</MenuItem>
          <MenuItem>Item 3</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};

Template.args = {};

export const DynamicSearchableMenu = () => {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Flex direction="column" gap="size-200">
      <Text>View the storybook for comments on implementation</Text>
      <MenuTrigger>
        <div>
          <Button leadingVisual={<Icon svg={<Icons.Search />} />}>
            Searchable Menu
          </Button>
        </div>
        <Popover>
          {/* Wrap the menu in an Autocomplete component */}
          <Autocomplete filter={contains}>
            {/* Nest a SearchField as child, it will automatically filter the sibling menu items */}
            <View paddingX="size-100" marginTop="size-100">
              <SearchField aria-label="Search" autoFocus>
                <Input placeholder="Search..." />
              </SearchField>
            </View>
            {/* Provide the items as a prop to menu, instantiating a react-aria collection */}
            <Menu items={NESTED_MENU_ITEMS}>
              {function renderMenuItem({ id, name, children }) {
                // handle items with children to generate submenus
                if (children) {
                  return (
                    <SubmenuTrigger>
                      <MenuItem key={id}>{name}</MenuItem>
                      <Popover>
                        {/* You can nest another Autocomplete here */}
                        <Autocomplete filter={contains}>
                          <View paddingX="size-100" marginTop="size-100">
                            {/* This will find the nearest autocomplete and menu items */}
                            <SearchField aria-label="Search">
                              <Input placeholder="Search..." />
                            </SearchField>
                          </View>
                          <Menu items={children}>
                            {/* recursively call the render fn to render submenu item children */}
                            {(item) => renderMenuItem(item)}
                          </Menu>
                        </Autocomplete>
                      </Popover>
                    </SubmenuTrigger>
                  );
                }
                // handle items with no children
                return <MenuItem key={id}>{name}</MenuItem>;
              }}
            </Menu>
          </Autocomplete>
        </Popover>
      </MenuTrigger>
    </Flex>
  );
};

export const SectionedMenu = () => {
  const lastSection = useMemo(() => {
    return NESTED_MENU_ITEMS[NESTED_MENU_ITEMS.length - 1];
  }, []);
  return (
    <Flex direction="column" gap="size-200">
      <Text>View the storybook for comments on implementation</Text>
      <MenuTrigger>
        <div>
          <Button>Menu with Sections</Button>
        </div>
        <Popover>
          <Menu
            items={NESTED_MENU_ITEMS}
            renderEmptyState={() => "No Items in Section"}
          >
            {/* You could support nested section rendering by naming this render function
                and calling it recursively. For now, this example just renders sections one level deep */}
            {(section) => {
              // do not render empty sections, it is difficult to add an empty state to them
              // you could possibly add a menu item that links to the place to add data that would populate this section
              if (!section.children) return <></>;
              return (
                <>
                  <MenuSection>
                    <Header>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text weight="heavy">{section.name}</Text>
                        <Text size="S">({section.children.length})</Text>
                      </Flex>
                    </Header>
                    <Collection items={section.children}>
                      {(item) => <MenuItem key={item.id}>{item.name}</MenuItem>}
                    </Collection>
                  </MenuSection>
                  {/* Only render a separator if this is not the last section, otherwise it looks ugly */}
                  {section.name !== lastSection.name && <Separator />}
                </>
              );
            }}
          </Menu>
        </Popover>
      </MenuTrigger>
    </Flex>
  );
};

// Generic sample data for filter menu
const FILTER_OPTIONS = [
  { id: "1", name: "Category A", color: "#3B82F6" },
  { id: "2", name: "Category B", color: "#10B981" },
  { id: "3", name: "Category C", color: "#F59E0B" },
  { id: "4", name: "Category D", color: "#EF4444" },
  { id: "5", name: "Category E", color: "#8B5CF6" },
  { id: "6", name: "Category F", color: "#06B6D4" },
  { id: "7", name: "Category G", color: "#84CC16" },
  { id: "8", name: "Category H", color: "#F97316" },
  { id: "9", name: "Category I", color: "#EC4899" },
  { id: "10", name: "Category JJJJJJJJJJJJJJJJJJJJJJ", color: "#6B7280" },
  { id: "11", name: "Category K", color: "#6B7280" },
  { id: "12", name: "Category L", color: "#6B7280" },
  { id: "13", name: "Category M", color: "#6B7280" },
  { id: "14", name: "Category N", color: "#6B7280" },
  { id: "15", name: "Category O", color: "#6B7280" },
  { id: "16", name: "Category P", color: "#6B7280" },
  { id: "17", name: "Category Q", color: "#6B7280" },
  { id: "18", name: "Category R", color: "#6B7280" },
  { id: "19", name: "Category S", color: "#6B7280" },
  { id: "20", name: "Category T", color: "#6B7280" },
  { id: "21", name: "Category U", color: "#6B7280" },
  { id: "22", name: "Category V", color: "#6B7280" },
  { id: "23", name: "Category W", color: "#6B7280" },
];

export const FilterMenu = () => {
  const { contains } = useFilter({ sensitivity: "base" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <Flex direction="column" gap="size-200">
      <Text>
        Generic filter menu with search and multi-select functionality
      </Text>
      <MenuTrigger>
        <Button leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}>
          Filter Categories
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
        <MenuContainer>
          <Autocomplete filter={contains}>
            <MenuHeader>
              <MenuHeaderTitle
                leadingContent={
                  <IconButton size="S">
                    <Icon svg={<Icons.ChevronLeft />} />
                  </IconButton>
                }
                trailingContent={
                  <IconButton size="S">
                    <Icon svg={<Icons.PlusCircleOutline />} />
                  </IconButton>
                }
              >
                Filter by Categories
              </MenuHeaderTitle>
              <SearchField aria-label="Search categories" autoFocus>
                <Input placeholder="Search categories..." />
              </SearchField>
            </MenuHeader>
            <Menu
              items={FILTER_OPTIONS}
              selectionMode="multiple"
              renderEmptyState={() => "No categories found"}
              selectedKeys={selectedIds}
              onSelectionChange={(keys) => {
                if (keys === "all") {
                  setSelectedIds(FILTER_OPTIONS.map((item) => item.id));
                } else {
                  setSelectedIds(Array.from(keys as Set<string>));
                }
              }}
            >
              {({ id, name, color }) => (
                <MenuItem id={id} textValue={name}>
                  <Token color={color}>
                    <Truncate maxWidth={80}>{name}</Truncate>
                  </Token>
                </MenuItem>
              )}
            </Menu>
          </Autocomplete>
          <MenuFooter>
            <Button>Apply</Button>
          </MenuFooter>
        </MenuContainer>
      </MenuTrigger>
      {selectedIds.length > 0 && (
        <Flex direction="column" gap="size-100">
          <Text size="S" weight="heavy">
            Selected Categories:
          </Text>
          <Flex wrap gap="size-100">
            {selectedIds.map((id) => {
              const option = FILTER_OPTIONS.find((opt) => opt.id === id);
              return option ? (
                <Token key={id} color={option.color}>
                  {option.name}
                </Token>
              ) : null;
            })}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};
