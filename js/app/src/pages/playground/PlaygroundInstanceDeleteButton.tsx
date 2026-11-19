import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundInstanceDeleteButton({
  instanceId,
}: {
  instanceId: number;
}) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);

  return (
    <TooltipTrigger>
      <Button
        size="S"
        aria-label="Delete this instance of the playground"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        onPress={() => {
          deleteInstance(instanceId);
        }}
      />
      <Tooltip>
        <TooltipArrow />
        Delete this instance of the playground
      </Tooltip>
    </TooltipTrigger>
  );
}
