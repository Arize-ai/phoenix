import { Flex } from "@phoenix/components";
import {
  AIQuerySettingsCard,
  BrowserModelCard,
} from "@phoenix/components/filter";

export function ProfileGenerativeAIPage() {
  return (
    <Flex direction="column" gap="size-200">
      <AIQuerySettingsCard />
      <BrowserModelCard />
    </Flex>
  );
}
