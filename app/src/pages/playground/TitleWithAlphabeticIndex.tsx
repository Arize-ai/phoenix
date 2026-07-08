import { Flex } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
/**
 * Display the alphabetic index and title in a single line
 */
export function TitleWithAlphabeticIndex({
  index,
  title,
}: {
  index: number;
  title: string;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <AlphabeticIndexIcon index={index} />
      <span>{title}</span>
    </Flex>
  );
}
