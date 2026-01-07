import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import { SizingProps } from "@phoenix/components/types";
import {
  isProgrammingLanguage,
  ProgrammingLanguage,
} from "@phoenix/types/code";

export function CodeLanguageRadioGroup({
  language,
  onChange,
  size,
}: {
  language: ProgrammingLanguage;
  onChange: (language: ProgrammingLanguage) => void;
} & SizingProps) {
  return (
    <ToggleButtonGroup
      size={size}
      selectedKeys={[language]}
      aria-label="Code Language"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const language = v.keys().next().value;
        if (isProgrammingLanguage(language)) {
          onChange(language);
        } else {
          throw new Error(`Unknown language: ${language}`);
        }
      }}
    >
      <ToggleButton aria-label="Python" id="Python">
        Python
      </ToggleButton>
      <ToggleButton aria-label="TypeScript" id="TypeScript">
        TypeScript
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
