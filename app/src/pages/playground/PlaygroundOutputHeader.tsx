import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { Counter } from "@phoenix/components/core/counter";
import { Flex } from "@phoenix/components/core/layout";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstanceProgressIndicator } from "./PlaygroundInstanceProgressIndicator";

export type PlaygroundOutputHeaderProps = {
  instanceId: number;
  index: number;
};

export function PlaygroundOutputHeader({
  instanceId,
  index,
}: PlaygroundOutputHeaderProps) {
  const errorCount = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)
        ?.experimentRunProgress?.runsFailed ?? 0
  );

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <AlphabeticIndexIcon index={index} size="XS" />
        <span>Output</span>
        {errorCount > 0 ? (
          <Counter variant="danger">{errorCount}</Counter>
        ) : null}
      </Flex>
      <PlaygroundInstanceProgressIndicator instanceId={instanceId} />
    </Flex>
  );
}
