export function PlaygroundCredentialsDropdown() {
  return (
    <DropdownTrigger placement="bottom right">
      <DropdownButton
        addonBefore={<Icon svg={<Icons.Code />} />}
      ></DropdownButton>
      <DropdownMenu>
        <View padding="size-200">
          <Form>
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField label="Span ID" isReadOnly value={spanId} />
              <CopyToClipboardButton text={spanId} size="default" />
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField label="Trace ID" isReadOnly value={traceId} />
              <CopyToClipboardButton text={traceId} size="default" />
            </Flex>
          </Form>
        </View>
      </DropdownMenu>
    </DropdownTrigger>
  );
}
