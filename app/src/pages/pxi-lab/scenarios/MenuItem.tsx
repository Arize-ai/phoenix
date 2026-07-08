import {
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Text,
  View,
} from "@phoenix/components";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";

import type { PxiScenario } from "./types";

const scenario: PxiScenario = {
  title: "Menu item",
  Component: function MenuItem() {
    return (
      <View
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        width="size-3000"
      >
        <ListBox aria-label="Span actions" selectionMode="none">
          <ListBoxItem textValue="View trace">
            <Flex direction="row" gap="size-75" alignItems="center">
              <Icon svg={<Icons.List />} />
              <Text>View trace</Text>
            </Flex>
          </ListBoxItem>
          <ListBoxItem textValue="Copy span ID">
            <Flex direction="row" gap="size-75" alignItems="center">
              <Icon svg={<Icons.Duplicate />} />
              <Text>Copy span ID</Text>
            </Flex>
          </ListBoxItem>
          <ListBoxItem textValue="Solve with PXI" className="pxi-menu-item">
            <Flex direction="row" gap="size-75" alignItems="center">
              <span className="pxi-menu-item__glyph" aria-hidden="true">
                <PxiGlyph size={12} />
              </span>
              <Text>Solve with PXI</Text>
            </Flex>
          </ListBoxItem>
        </ListBox>
      </View>
    );
  },
};

export default scenario;
