import { Autocomplete, Input, useFilter } from "react-aria-components";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  Text,
} from "@phoenix/components";

type EvaluatorSelectProps = {
  evaluators: {
    id: string;
    name: string;
    kind: string;
  }[];
};

export function EvaluatorSelect(props: EvaluatorSelectProps) {
  const { evaluators } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <MenuTrigger>
      <Button leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
        Add evaluator
      </Button>
      <MenuContainer>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search" autoFocus>
              <Input placeholder="Search evaluators" />
            </SearchField>
          </MenuHeader>
          <Menu
            selectionMode="multiple"
            selectedKeys={[]} // TODO
            items={evaluators}
            renderEmptyState={() => (
              //   <View padding="size-100">
              <Text color="grey-300" size="S">
                No evaluators found
              </Text>
              //   </View>
            )}
          >
            {({ name, kind }) => (
              <MenuItem
                textValue={name}
                onAction={() => {
                  // TODO
                }}
              >
                {kind}: {name}
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}
