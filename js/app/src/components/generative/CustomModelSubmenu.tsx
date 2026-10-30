import type { Key } from "react-aria-components";
import { SubmenuTrigger } from "react-aria-components";

import {
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
} from "@phoenix/components";

import {
  ModelCredentialHint,
  ModelProviderIcon,
  ModelRowLayout,
} from "./ModelPickerRow";
import type { CustomModelOption, ModelProviderOption } from "./modelSearch";

/** A provider picked for a typed model name. */
export type CustomModelProviderPick = {
  modelName: string;
  provider: ModelProviderOption;
};

/**
 * The second line of a provider in the custom-model submenu: why it's first,
 * that Azure takes deployment names, or that it's a custom provider.
 */
function getCustomModelProviderNote({
  option,
  isGuessed,
}: {
  option: ModelProviderOption;
  isGuessed: boolean;
}): string | undefined {
  if (option.customProvider) {
    return "Custom provider";
  }
  if (option.provider === "AZURE_OPENAI") {
    return "As a deployment name";
  }
  return isGuessed ? "Guessed from the name" : undefined;
}

/**
 * The "Use `x` as a custom model" row and its provider submenu, which opens
 * on hover, ArrowRight or Enter. Picking a provider sends the typed name to
 * it. Render it inside a picker's `Menu`; the option comes from
 * `getCustomModelOption`.
 */
export function CustomModelSubmenu({
  id,
  option,
  onPick,
}: {
  id: string;
  option: CustomModelOption;
  onPick: (pick: CustomModelProviderPick) => void;
}) {
  const handleAction = (key: Key) => {
    const provider = option.providers.find(
      (candidate) => candidate.key === String(key)
    );
    if (provider) {
      onPick({ modelName: option.modelName, provider });
    }
  };
  return (
    <SubmenuTrigger>
      <MenuItem id={id} textValue={`Use ${option.modelName} as a custom model`}>
        <ModelRowLayout
          leadingVisual={<Icon svg={<Icons.Edit />} />}
          name={`Use "${option.modelName}" as a custom model`}
          secondary="Choose a provider"
        />
      </MenuItem>
      <MenuContainer minHeight={0} minWidth={260} maxWidth={320}>
        <Menu
          aria-label={`Providers for ${option.modelName}`}
          onAction={handleAction}
        >
          {option.providers.map((provider) => (
            <MenuItem
              key={provider.key}
              id={provider.key}
              textValue={provider.name}
            >
              <ModelRowLayout
                leadingVisual={
                  <ModelProviderIcon provider={provider.provider} />
                }
                name={provider.name}
                secondary={getCustomModelProviderNote({
                  option: provider,
                  isGuessed: provider.key === option.guessedProviderKey,
                })}
                trailing={
                  <ModelCredentialHint
                    credentialState={provider.credentialState}
                  />
                }
              />
            </MenuItem>
          ))}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}
