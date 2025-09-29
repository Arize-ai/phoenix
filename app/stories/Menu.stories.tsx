import {
  Autocomplete,
  Input,
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
    name: "Item 1",
    children: [
      {
        id: "1.1",
        name: "Item 1.1",
      },
    ],
  },
  {
    id: "2",
    name: "Item 2",
  },
  {
    id: "3",
    name: "Item 3",
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
        name: "Item 3.3",
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

Template.args = {};
