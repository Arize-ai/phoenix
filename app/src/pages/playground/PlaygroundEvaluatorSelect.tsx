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
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import {
  EvaluatorItem,
  EvaluatorSelectMenuItem,
} from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import type { EvaluatorKind } from "@phoenix/types";
import { isStringArray } from "@phoenix/typeUtils";

type PlaygroundEvaluatorSelectProps = {
  datasetId: string;
  evaluators: EvaluatorItem[];
  selectedIds?: string[];
  onSelectionChange: (keys: string[]) => void;
};

export function PlaygroundEvaluatorSelect(
  props: PlaygroundEvaluatorSelectProps
) {
  const { evaluators, selectedIds, onSelectionChange, datasetId } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  const [editingEvaluator, setEditingEvaluator] = useState<{
    datasetEvaluatorId: string;
    kind: EvaluatorKind;
    isBuiltIn: boolean;
  } | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onEdit = ({
    datasetEvaluatorId,
    kind,
    isBuiltIn,
  }: {
    datasetEvaluatorId: string;
    kind: EvaluatorKind;
    isBuiltIn: boolean;
  }) => {
    setEditingEvaluator({ datasetEvaluatorId, kind, isBuiltIn });
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
                    onEdit={() =>
                      onEdit({
                        datasetEvaluatorId: evaluator.id,
                        kind: evaluator.kind,
                        isBuiltIn: evaluator.isBuiltIn,
                      })
                    }
                  />
                ))}
              </GridListSection>
            </GridList>
          </Autocomplete>
        </MenuContainer>
      </DialogTrigger>
      <EditLLMDatasetEvaluatorSlideover
        datasetEvaluatorId={editingEvaluator?.datasetEvaluatorId}
        datasetId={datasetId}
        isOpen={
          editingEvaluator !== null &&
          editingEvaluator.kind === "LLM" &&
          editingEvaluator.isBuiltIn === false
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvaluator(null);
          }
        }}
      />
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={editingEvaluator?.datasetEvaluatorId}
        datasetId={datasetId}
        isOpen={editingEvaluator !== null && editingEvaluator.isBuiltIn}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvaluator(null);
          }
        }}
      />
    </>
  );
}
