import invariant from "tiny-invariant";

import { Button } from "@phoenix/components";
import { useViewer } from "@phoenix/contexts";

import { GeneratePersonalAPIKeyButton } from "./GeneratePersonalAPIKeyButton";
import { GenerateSystemAPIKeyButton } from "./GenerateSystemAPIKeyButton";

type GenerateAPIKeyButtonProps = {
  /**
   * Callback invoked when an API key is successfully generated.
   * @param apiKey - The generated JWT API key
   */
  onApiKeyGenerated: (apiKey: string) => void;
  /**
   * The name to give the generated API key.
   * @default "System Key" for admins, "Personal Key" for members
   */
  keyName?: string;
};

/**
 * A button that generates an API key based on the user's role.
 * - Admin users will generate a system API key
 * - Member users will generate a personal API key
 * - Viewer users will see a disabled button (no permission to create keys)
 */
export function GenerateAPIKeyButton({
  onApiKeyGenerated,
  keyName,
}: GenerateAPIKeyButtonProps) {
  const { viewer } = useViewer();

  invariant(viewer?.role, "User role is required to generate an API key");

  const roleName = viewer.role.name;

  if (roleName === "VIEWER") {
    return (
      <Button size="S" isDisabled>
        Generate API Key
      </Button>
    );
  }

  if (roleName === "ADMIN") {
    return (
      <GenerateSystemAPIKeyButton
        onApiKeyGenerated={onApiKeyGenerated}
        keyName={keyName}
      />
    );
  }

  return (
    <GeneratePersonalAPIKeyButton
      onApiKeyGenerated={onApiKeyGenerated}
      keyName={keyName}
    />
  );
}
