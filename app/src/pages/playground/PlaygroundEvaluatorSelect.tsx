import { useState } from "react";
import {
  Autocomplete,
  GridListSection,
  Input,
  useFilter,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  GridList,
  GridListSectionTitle,
  Icon,
  Icons,
  MenuContainer,
  MenuHeader,
  SearchField,
  SearchIcon,
  Text,
} from "@phoenix/components";
import { EditEvaluatorSlideover } from "@phoenix/components/evaluators/EditEvaluatorSlideover";
import {
  EvaluatorItem,
  EvaluatorSelectMenuItem,
} from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { isStringArray } from "@phoenix/typeUtils";

type PlaygroundEvaluatorSelectProps = {
  evaluators: EvaluatorItem[];
  selectedIds?: string[];
  onSelectionChange: (keys: string[]) => void;
};

export function PlaygroundEvaluatorSelect(
  props: PlaygroundEvaluatorSelectProps
) {
  const { evaluators, selectedIds, onSelectionChange } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  const [editingEvaluatorId, setEditingEvaluatorId] = useState<string | null>(
    null
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onEdit = (evaluatorId: string) => {
    setEditingEvaluatorId(evaluatorId);
    setIsPopoverOpen(false);
  };

  return (
    <>
      <DialogTrigger isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Button size="S" leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
          Add evaluator
        </Button>
        <MenuContainer placement="top end" shouldFlip={true}>
          <Autocomplete filter={contains}>
            <MenuHeader>
              <SearchField aria-label="Search" autoFocus>
                <SearchIcon />
                <Input placeholder="Search evaluators" />
              </SearchField>
            </MenuHeader>
            <GridList
              selectionMode="multiple"
              selectedKeys={selectedIds}
              onSelectionChange={(keys) => {
                if (keys === "all") {
                  return;
                }
                const keysArray = Array.from(keys);
                if (!isStringArray(keysArray)) {
                  return;
                }
                onSelectionChange(keysArray);
              }}
              renderEmptyState={() => (
                <Text color="grey-300" size="S">
                  No evaluators found
                </Text>
              )}
              css={css`
                max-width: 600px;
              `}
            >
              <GridListSection>
                <GridListSectionTitle title="Evaluators" />
                {evaluators.map((evaluator) => (
                  <EvaluatorSelectMenuItem
                    key={evaluator.id}
                    evaluator={evaluator}
                    isSelected={selectedIds?.includes(evaluator.id) ?? false}
                    onEdit={() => onEdit(evaluator.id)}
                  />
                ))}
              </GridListSection>
            </GridList>
          </Autocomplete>
        </MenuContainer>
      </DialogTrigger>
      <EditEvaluatorSlideover
        evaluatorId={editingEvaluatorId ?? ""}
        isOpen={!!editingEvaluatorId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvaluatorId(null);
          }
        }}
      />
    </>
  );
}
