import { useState } from "react";
import { Autocomplete, Input, useFilter } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SearchIcon,
  Text,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

type EvaluatorItem = {
  id: string;
  name: string;
  kind: "CODE" | "LLM";
  alreadyAdded?: boolean;
};

type EvaluatorSelectProps = {
  evaluators: EvaluatorItem[];
  selectedIds: string[];
  onSelectionChange: (id: string) => void;
  addNewEvaluatorLink: string;
};

export function EvaluatorSelect(props: EvaluatorSelectProps) {
  const { evaluators, selectedIds, onSelectionChange, addNewEvaluatorLink } =
    props;
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
              max-width: 300px;
            `}
          >
            {(evaluator) => (
              <EvaluatorMenuItem
                evaluator={evaluator}
                onSelectionChange={() => onSelectionChange(evaluator.id)}
                isSelected={selectedIds.includes(evaluator.id)}
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

type EvaluatorMenuItemProps = {
  evaluator: EvaluatorItem;
  onSelectionChange: () => void;
  isSelected: boolean;
};

function EvaluatorMenuItem({
  evaluator,
  onSelectionChange,
  isSelected,
}: EvaluatorMenuItemProps) {
  const { name, kind, alreadyAdded } = evaluator;

  const [isHovered, setIsHovered] = useState(false);
  const showAlreadyAddedState = alreadyAdded && isHovered && !isSelected;

  const onMouseEnter = () => {
    setIsHovered(true);
  };
  const onMouseLeave = () => {
    setIsHovered(false);
  };

  let icon =
    kind === "CODE" ? (
      <Icon svg={<Icons.Code />} />
    ) : (
      <Icon svg={<Icons.Robot />} />
    );
  if (showAlreadyAddedState) {
    icon = <Icon svg={<Icons.Checkmark />} />;
  }

  return (
    <MenuItem
      id={evaluator.id}
      textValue={name}
      onAction={onSelectionChange}
      isDisabled={alreadyAdded}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Flex
        alignItems="center"
        gap="size-100"
        css={css`
          color: var(--ac-global-color-grey-800);
          font-size: var(--ac-global-font-size-s);
          opacity: ${alreadyAdded ? "0.25" : 1};
          overflow: hidden;
        `}
      >
        {icon}
        <Text
          css={css`
            overflow: hidden;
          `}
        >
          <Truncate maxWidth="100%">
            {showAlreadyAddedState ? "Already added" : name}
          </Truncate>
        </Text>
      </Flex>
    </MenuItem>
  );
}
