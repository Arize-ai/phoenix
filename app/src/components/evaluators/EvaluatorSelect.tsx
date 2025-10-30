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

type EvaluatorItem = {
  id: string;
  name: string;
  kind: string;
  alreadyAdded: boolean;
};

type EvaluatorSelectProps = {
  evaluators: EvaluatorItem[];
  selectedIds: string[];
  onSelectionChange: (id: string) => void;
};

export function EvaluatorSelect(props: EvaluatorSelectProps) {
  const { evaluators, selectedIds, onSelectionChange } = props;
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
            selectedKeys={selectedIds}
            items={evaluators}
            renderEmptyState={() => (
              <Text color="grey-300" size="S">
                No evaluators found
              </Text>
            )}
          >
            {({ id, name, kind }) => (
              <MenuItem
                textValue={name}
                onAction={() => {
                  onSelectionChange(id);
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
