import { Flex, Icon, Icons, Text } from "@phoenix/components";

export function ClearingTracesIndicator() {
  return (
    <Flex direction="row" alignItems="center" gap="size-50">
      <Icon svg={<Icons.Loading />} />
      <Text color="text-700" size="XS">
        Clearing traces…
      </Text>
    </Flex>
  );
}
