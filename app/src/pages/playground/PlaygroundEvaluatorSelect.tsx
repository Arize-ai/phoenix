import { Autocomplete, Input, useFilter } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  LinkButton,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuTrigger,
  SearchField,
  SearchIcon,
  Text,
} from "@phoenix/components";
import {
  EvaluatorItem,
  EvaluatorSelectMenuItem,
} from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";

type PlaygroundEvaluatorSelectProps = {
  evaluators: (EvaluatorItem & { isAssignedToDataset: boolean })[];
  selectedIds?: string[];
  onSelectionChange: (id: string) => void;
  addNewEvaluatorLink: string;
};

export function PlaygroundEvaluatorSelect(
  props: PlaygroundEvaluatorSelectProps
) {
  const { evaluators, selectedIds, onSelectionChange, addNewEvaluatorLink } =
    props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <MenuTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
        Add evaluator
      </Button>
      <MenuContainer placement="top end">
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search" autoFocus>
              <SearchIcon />
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
            css={css`
              max-width: 600px;
            `}
          >
            {(evaluator) => (
              <EvaluatorSelectMenuItem
                evaluator={evaluator}
                onSelectionChange={() => onSelectionChange(evaluator.id)}
                isSelected={selectedIds?.includes(evaluator.id) ?? false}
              />
            )}
          </Menu>
        </Autocomplete>
        <MenuFooter>
          <LinkButton variant="quiet" to={addNewEvaluatorLink}>
            New evaluator
          </LinkButton>
        </MenuFooter>
      </MenuContainer>
    </MenuTrigger>
  );
}
