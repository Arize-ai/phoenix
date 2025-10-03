import { useMemo } from "react";
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
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Separator,
  Text,
  View,
} from "@phoenix/components";

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
