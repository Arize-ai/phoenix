import { useState } from "react";
import {
  Autocomplete,
  Input,
  SelectionMode,
  useFilter,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  ButtonProps,
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
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import { Truncate } from "@phoenix/components/utility/Truncate";

export type EvaluatorItem = {
  id: string;
  name: string;
  kind: "CODE" | "LLM";
  alreadyAdded?: boolean;
  annotationName?: string;
};

type EvaluatorSelectProps = {
  evaluators: EvaluatorItem[];
  selectedIds?: string[];
  onSelectionChange: (id: string) => void;
  addNewEvaluatorLink: string;
  selectionMode?: SelectionMode;
  size?: ButtonProps["size"];
};

export function EvaluatorSelect(props: EvaluatorSelectProps) {
  const {
    evaluators,
    selectedIds,
    onSelectionChange,
    addNewEvaluatorLink,
    selectionMode = "multiple",
    size = "S",
  } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <MenuTrigger>
      <Button size={size} leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
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
            selectionMode={selectionMode}
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
              <EvaluatorMenuItem
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
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap="size-300"
        width="100%"
        css={css`
          opacity: ${alreadyAdded ? "0.25" : 1};
        `}
      >
        <Flex
          alignItems="center"
          gap="size-100"
          css={css`
            color: var(--ac-global-color-grey-700);
            font-size: var(--ac-global-font-size-s);
            overflow: hidden;
          `}
        >
          {icon}
          <Text
            color="inherit"
            css={css`
              overflow: hidden;
            `}
          >
            <Truncate maxWidth="100%">
              {showAlreadyAddedState ? "Already added" : name}
            </Truncate>
          </Text>
        </Flex>
        {evaluator.annotationName && (
          <div
            css={css`
              color: var(--ac-global-color-grey-600);
            `}
          >
            <AnnotationNameAndValue
              annotation={{ name: evaluator.annotationName }}
              displayPreference="none"
              size="XS"
            />
          </div>
        )}
      </Flex>
    </MenuItem>
  );
}
