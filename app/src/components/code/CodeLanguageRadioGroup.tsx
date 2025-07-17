import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import { SizingProps } from "@phoenix/components/types";

export type CodeLanguage = "Python" | "TypeScript";

const codeLanguages: CodeLanguage[] = ["Python", "TypeScript"];

/**
 * TypeGuard for the code language
 */
function isCodeLanguage(l: unknown): l is CodeLanguage {
  return typeof l === "string" && codeLanguages.includes(l as CodeLanguage);
}

export function CodeLanguageRadioGroup({
  language,
  onChange,
  size,
}: {
  language: CodeLanguage;
  onChange: (language: CodeLanguage) => void;
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
        if (isCodeLanguage(language)) {
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
