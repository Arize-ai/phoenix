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

type DatasetEvaluatorSelectProps = {
  evaluators: EvaluatorItem[];
  onSelectionChange: (id: string) => void;
  addNewEvaluatorLink: string;
};

export function DatasetEvaluatorSelect(props: DatasetEvaluatorSelectProps) {
  const { evaluators, onSelectionChange, addNewEvaluatorLink } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <MenuTrigger>
      <Button size="M" leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
        Add evaluator
      </Button>
      <MenuContainer>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search" autoFocus>
              <SearchIcon />
              <Input placeholder="Search evaluators" />
            </SearchField>
          </MenuHeader>
          <Menu
            selectionMode="none"
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
