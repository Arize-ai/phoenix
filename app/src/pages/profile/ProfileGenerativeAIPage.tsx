import { Flex } from "@phoenix/components";
import {
  AISearchSettingsCard,
  BrowserModelCard,
} from "@phoenix/components/filter";

export function ProfileGenerativeAIPage() {
  return (
    <Flex direction="column" gap="size-200">
      <AISearchSettingsCard />
      <BrowserModelCard />
    </Flex>
  );
}
