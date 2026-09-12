import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { TriggerWrap } from "@phoenix/components/core/tooltip";

import { isProjectEvaluatorUpdate } from "./evaluatorSaveTarget";
import { EVALUATOR_SLOT_IDS, getSlotIndex } from "./evaluatorSlotTypes";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";

/**
 * "Save filter": stores the strip's applied span filter on one of the project
 * evaluators loaded into the visible slots. It is that slot's normal save with
 * the filter overridden, so the whole evaluator is written, not just the filter.
 */
export function EvaluatorPlaygroundSaveFilterMenu({
  slots,
  visibleSlotIds,
  filterCondition,
  isFilterValid,
  isDisabled,
  onSave,
}: {
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  visibleSlotIds: SlotId[];
  filterCondition: string;
  isFilterValid: boolean;
  isDisabled: boolean;
  onSave: (slot: SlotId) => void;
}) {
  const qualifying = visibleSlotIds.filter((slotId) => {
    const target = slots[slotId]?.saveTarget;

    return target != null && isProjectEvaluatorUpdate(target);
  });

  const reason = !isFilterValid
    ? "Fix the filter condition before saving it."
    : !qualifying.length
      ? "Load an evaluator saved on this project into a slot to save the filter to it."
      : null;

  if (reason || isDisabled)
    return (
      <TooltipTrigger>
        <TriggerWrap>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.Save />} />}
            isDisabled
          >
            Save filter
          </Button>
        </TriggerWrap>
        <Tooltip>
          <TooltipArrow />
          {reason ?? "Wait for the run to finish."}
        </Tooltip>
      </TooltipTrigger>
    );

  return (
    <MenuTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Save />} />}>
        Save filter
      </Button>
      <Popover placement="bottom end">
        <Menu
          aria-label="Save the filter to a project evaluator"
          onAction={(key) => {
            const slotId = String(key) as SlotId;

            if (EVALUATOR_SLOT_IDS.includes(slotId)) onSave(slotId);
          }}
        >
          {qualifying.map((slotId) => (
            <MenuItem key={slotId} id={slotId} textValue={slots[slotId]?.name}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <AlphabeticIndexIcon index={getSlotIndex(slotId)} size="XS" />
                <Text>{slots[slotId]?.name}</Text>
                <Text size="XS" color="text-500" fontFamily="mono">
                  {filterCondition || "(no filter)"}
                </Text>
              </Flex>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
