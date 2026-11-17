import { Flex, Icon, Icons, Text } from "@phoenix/components";

export function ClearingTracesIndicator() {
  return (
    <div role="status">
      <Flex direction="row" alignItems="center" gap="size-50">
        <Icon aria-hidden="true" svg={<Icons.Loading />} />
        <Text color="text-700" size="XS">
          Clearing traces…
        </Text>
      </Flex>
    </div>
  );
}
