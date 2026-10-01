import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";

const countFormatter = new Intl.NumberFormat();

export function ProjectEvaluatorQueueCell({
  runSummary,
}: {
  runSummary: {
    queuedCount: number;
    oldestQueuedAt: string | null;
    newestQueuedAt: string | null;
  };
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const { queuedCount, oldestQueuedAt, newestQueuedAt } = runSummary;
  const count = (
    <Text fontFamily="mono" color={queuedCount === 0 ? "text-700" : "text-900"}>
      {countFormatter.format(queuedCount)}
    </Text>
  );
  if (oldestQueuedAt == null || newestQueuedAt == null) {
    return count;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>{count}</TriggerWrap>
      <RichTooltip placement="end">
        <Flex direction="column" gap="size-50">
          <Text size="S">Queued work window</Text>
          <Text size="S">{`Oldest: ${fullTimeFormatter(new Date(oldestQueuedAt))}`}</Text>
          <Text size="S">{`Newest: ${fullTimeFormatter(new Date(newestQueuedAt))}`}</Text>
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
